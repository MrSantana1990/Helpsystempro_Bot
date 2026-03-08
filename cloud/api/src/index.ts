import express from "express";
import cors from "cors";
import QRCode from "qrcode";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { getEnv } from "./env.js";
import { dbInit, pool } from "./db.js";
import { appRouter } from "./routers.js";
import { createContext } from "./context.js";
import { id } from "./ids.js";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { signJwt, verifyJwt, type JwtPayload } from "./auth/jwt.js";
import { encryptText, decryptText } from "./crypto.js";
import { generateTotpSecret, totpOtpAuthUrl, totpVerify } from "./auth/totp.js";
import { createBillingProvider, normalizeHeaders, type InvoiceStatus } from "./billing/provider.js";

const env = getEnv();
await dbInit();
const billingProvider = createBillingProvider(env);

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

let apiRequestsTotal = 0;
let apiRequestErrorsTotal = 0;
let apiRequestLatencySumSeconds = 0;
let apiRequestLatencyCount = 0;

app.use((req, res, next) => {
  const started = Date.now();
  const requestId = String(req.headers["x-request-id"] || id("req")).slice(0, 80);
  (req as any).requestId = requestId;
  res.setHeader("X-Request-ID", requestId);
  res.on("finish", () => {
    const duration = Math.max(0, Date.now() - started) / 1000;
    apiRequestsTotal += 1;
    apiRequestLatencyCount += 1;
    apiRequestLatencySumSeconds += duration;
    if (res.statusCode >= 400) apiRequestErrorsTotal += 1;
    const auth = String(req.headers.authorization || "");
    let tenantId = "-";
    if (auth.toLowerCase().startsWith("bearer ")) {
      try {
        const payload = verifyJwt(auth.slice(7).trim());
        const tenantIds = Array.isArray(payload.tenantIds) ? payload.tenantIds : [];
        tenantId = String(tenantIds[0] || "-");
      } catch {
        tenantId = "-";
      }
    }
    const log = {
      ts_utc: new Date().toISOString(),
      level: "info",
      request_id: requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration_s: Number(duration.toFixed(4)),
      tenant_id: tenantId
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(log));
  });
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "cloud-api", ts: new Date().toISOString() }));

app.get("/api/metrics", (_req, res) => {
  const lines = [
    "# HELP api_requests_total Total de requisições na API cloud.",
    "# TYPE api_requests_total counter",
    `api_requests_total ${apiRequestsTotal}`,
    "# HELP api_request_errors_total Total de respostas de erro na API cloud.",
    "# TYPE api_request_errors_total counter",
    `api_request_errors_total ${apiRequestErrorsTotal}`,
    "# HELP api_request_duration_seconds_sum Soma da latência de requisições na API cloud.",
    "# TYPE api_request_duration_seconds_sum counter",
    `api_request_duration_seconds_sum ${apiRequestLatencySumSeconds.toFixed(6)}`,
    "# HELP api_request_duration_seconds_count Quantidade de requisições com latência registrada na API cloud.",
    "# TYPE api_request_duration_seconds_count counter",
    `api_request_duration_seconds_count ${apiRequestLatencyCount}`
  ];
  res.setHeader("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return res.send(lines.join("\n") + "\n");
});

function sendError(res: express.Response, status: number, message: string, code: string) {
  return res.status(status).json({
    ok: false,
    error: message,
    detail: message,
    code
  });
}

function bearerToken(req: express.Request): string | null {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return null;
}

function normEmail(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function masterEmail(): string {
  return normEmail(process.env.HSP_MASTER_EMAIL || "");
}

function maskEmail(email: string): string {
  const value = normEmail(email);
  const at = value.indexOf("@");
  if (at <= 1) return value;
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

function toJsonSafe(v: unknown): string {
  try {
    return JSON.stringify(v ?? {});
  } catch {
    return "{}";
  }
}

function pgCode(err: unknown): string {
  return String((err as any)?.code || "");
}

function isPgUniqueViolation(err: unknown): boolean {
  return pgCode(err) === "23505";
}

function isPgForeignKeyViolation(err: unknown): boolean {
  return pgCode(err) === "23503";
}

async function writeAudit(action: string, opts: { userId?: string | null; tenantId?: string | null; detail?: unknown } = {}) {
  try {
    const p = pool();
    await p.query("INSERT INTO audit_log (id, user_id, tenant_id, action, detail_json) VALUES ($1,$2,$3,$4,$5)", [
      id("adt"),
      opts.userId || null,
      opts.tenantId || null,
      action,
      toJsonSafe(opts.detail ?? {})
    ]);
  } catch {
    // best effort only
  }
}

function requireAuth(req: express.Request, res: express.Response): JwtPayload & { id: string } {
  const token = bearerToken(req);
  if (!token) {
    sendError(res, 401, "Nao autenticado. Faca login para continuar.", "UNAUTHORIZED");
    throw new Error("unauthorized");
  }
  try {
    const payload = verifyJwt(token);
    return { ...payload, id: payload.sub };
  } catch {
    sendError(res, 401, "Token invalido. Faca login novamente.", "INVALID_TOKEN");
    throw new Error("unauthorized");
  }
}

function requireAdmin(req: express.Request, res: express.Response) {
  const user = requireAuth(req, res);
  if (user.role !== "admin") {
    sendError(res, 403, "Acesso restrito ao administrador.", "FORBIDDEN");
    throw new Error("forbidden");
  }
  return user;
}

async function requireMasterAdmin(req: express.Request, res: express.Response) {
  const user = requireAdmin(req, res);
  const master = masterEmail();
  if (!master) return user;
  const p = pool();
  const result = await p.query("SELECT email FROM users WHERE id=$1 LIMIT 1", [user.id]);
  const userEmail = normEmail(result.rows?.[0]?.email);
  if (!userEmail || userEmail !== master) {
    sendError(res, 403, "Apenas a conta master pode acessar este painel.", "FORBIDDEN_MASTER");
    throw new Error("forbidden-master");
  }
  return user;
}

async function currentUserEmail(userId: string): Promise<string> {
  const p = pool();
  const result = await p.query("SELECT email FROM users WHERE id=$1 LIMIT 1", [userId]);
  return normEmail(result.rows?.[0]?.email);
}

type MobileConnectMode = "local" | "lan" | "custom";
type MobileConnectSettings = {
  mode: MobileConnectMode;
  lanHost: string;
  apiPort: number;
  customBaseUrl: string;
  token: string;
};

const MOBILE_CONNECT_KEY = "mobile_connect_settings";
const MOBILE_CONNECT_DEFAULTS: MobileConnectSettings = {
  mode: "local",
  lanHost: "",
  apiPort: 8502,
  customBaseUrl: "",
  token: "local-dev"
};

const PLAN_VALUES = ["starter", "pro", "premium"] as const;
const BILLING_CYCLE_VALUES = ["monthly", "quarterly", "semiannual", "annual"] as const;
const LICENSE_STATUS_VALUES = ["active", "expired", "suspended"] as const;
const BILLING_STATUS_VALUES = ["pending", "failed", "paid"] as const;
const INVOICE_STATUS_VALUES = ["pending", "paid", "overdue", "cancelled", "suspended", "failed"] as const;
const SUBSCRIPTION_STATUS_VALUES = ["active", "grace_period", "suspended", "cancelled"] as const;
const ONBOARDING_STATUS_VALUES = ["pending", "approved", "rejected"] as const;
const REQUEST_PAYMENT_STATUS_VALUES = ["pending", "paid", "failed"] as const;

type PlanValue = (typeof PLAN_VALUES)[number];
type BillingCycleValue = (typeof BILLING_CYCLE_VALUES)[number];
type SubscriptionStatusValue = (typeof SUBSCRIPTION_STATUS_VALUES)[number];

const PLAN_FEATURE_FLAGS: Record<
  PlanValue,
  {
    max_symbols: number;
    max_orders_per_day: number;
    risk_advanced: boolean;
    telegram_alerts: boolean;
    cloud_execution: boolean;
    decision_engine_v2: boolean;
  }
> = {
  starter: {
    max_symbols: 6,
    max_orders_per_day: 30,
    risk_advanced: false,
    telegram_alerts: false,
    cloud_execution: false,
    decision_engine_v2: false
  },
  pro: {
    max_symbols: 15,
    max_orders_per_day: 80,
    risk_advanced: true,
    telegram_alerts: true,
    cloud_execution: true,
    decision_engine_v2: true
  },
  premium: {
    max_symbols: 40,
    max_orders_per_day: 250,
    risk_advanced: true,
    telegram_alerts: true,
    cloud_execution: true,
    decision_engine_v2: true
  }
};

const PLAN_CATALOG: Record<PlanValue, Record<BillingCycleValue, { amountCents: number; currency: string; title: string; perks: string[] }>> = {
  starter: {
    monthly: {
      amountCents: 4900,
      currency: "BRL",
      title: "Starter mensal",
      perks: ["Acesso ao painel operacional", "Monitoramento básico de mercado", "Suporte padrão por e-mail"]
    },
    quarterly: {
      amountCents: 13700,
      currency: "BRL",
      title: "Starter trimestral",
      perks: ["Economia no ciclo trimestral", "Monitoramento básico de mercado", "Suporte padrão por e-mail"]
    },
    semiannual: {
      amountCents: 25800,
      currency: "BRL",
      title: "Starter semestral",
      perks: ["Melhor custo-benefício", "Monitoramento básico de mercado", "Suporte padrão por e-mail"]
    },
    annual: {
      amountCents: 47900,
      currency: "BRL",
      title: "Starter anual",
      perks: ["Ciclo anual com desconto máximo", "Monitoramento básico de mercado", "Suporte padrão por e-mail"]
    }
  },
  pro: {
    monthly: {
      amountCents: 9700,
      currency: "BRL",
      title: "Pro mensal",
      perks: ["Tudo do Starter", "Alertas avançados", "Relatórios operacionais e auditoria"]
    },
    quarterly: {
      amountCents: 27900,
      currency: "BRL",
      title: "Pro trimestral",
      perks: ["Tudo do Starter", "Alertas avançados", "Relatórios operacionais e auditoria"]
    },
    semiannual: {
      amountCents: 52800,
      currency: "BRL",
      title: "Pro semestral",
      perks: ["Tudo do Starter", "Alertas avançados", "Relatórios operacionais e auditoria"]
    },
    annual: {
      amountCents: 99700,
      currency: "BRL",
      title: "Pro anual",
      perks: ["Tudo do Starter", "Alertas avançados", "Relatórios operacionais e auditoria"]
    }
  },
  premium: {
    monthly: {
      amountCents: 19700,
      currency: "BRL",
      title: "Premium mensal",
      perks: ["Tudo do Pro", "Acompanhamento prioritário", "Tuning operacional dedicado"]
    },
    quarterly: {
      amountCents: 56700,
      currency: "BRL",
      title: "Premium trimestral",
      perks: ["Tudo do Pro", "Acompanhamento prioritário", "Tuning operacional dedicado"]
    },
    semiannual: {
      amountCents: 107000,
      currency: "BRL",
      title: "Premium semestral",
      perks: ["Tudo do Pro", "Acompanhamento prioritário", "Tuning operacional dedicado"]
    },
    annual: {
      amountCents: 198000,
      currency: "BRL",
      title: "Premium anual",
      perks: ["Tudo do Pro", "Acompanhamento prioritário", "Tuning operacional dedicado"]
    }
  }
};

function normalizePlan(value: unknown, fallback: (typeof PLAN_VALUES)[number] = "starter"): (typeof PLAN_VALUES)[number] {
  const parsed = String(value || "").trim().toLowerCase();
  return (PLAN_VALUES as readonly string[]).includes(parsed) ? (parsed as (typeof PLAN_VALUES)[number]) : fallback;
}

function normalizeEnum<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  const parsed = String(value || "").trim().toLowerCase();
  return (allowed as readonly string[]).includes(parsed) ? (parsed as T[number]) : fallback;
}

function normalizeBillingCycle(value: unknown, fallback: BillingCycleValue = "monthly"): BillingCycleValue {
  return normalizeEnum(value, BILLING_CYCLE_VALUES, fallback);
}

function cycleDurationDays(cycle: BillingCycleValue): number {
  if (cycle === "quarterly") return 90;
  if (cycle === "semiannual") return 182;
  if (cycle === "annual") return 365;
  return 30;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function planOffer(plan: PlanValue, cycle: BillingCycleValue) {
  const byPlan = PLAN_CATALOG[plan] || PLAN_CATALOG.starter;
  return byPlan[cycle] || byPlan.monthly;
}

function planFeatures(plan: PlanValue) {
  return PLAN_FEATURE_FLAGS[plan] || PLAN_FEATURE_FLAGS.starter;
}

function parseDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function subscriptionStatusFromInvoice(
  invoiceStatus: string,
  dueAt: Date | null,
  now: Date,
  graceDays: number
): SubscriptionStatusValue {
  const parsed = String(invoiceStatus || "").trim().toLowerCase();
  if (parsed === "paid") return "active";
  if (parsed === "cancelled") return "cancelled";
  if (parsed === "suspended" || parsed === "failed") return "suspended";
  const due = dueAt ? dueAt.getTime() : now.getTime();
  const graceLimit = due + Math.max(0, graceDays) * 24 * 60 * 60 * 1000;
  if (now.getTime() > graceLimit) return "suspended";
  return "grace_period";
}

async function syncTenantSubscriptionByBilling(tenantId: string): Promise<void> {
  const p = pool();
  const [subResult, invoiceResult] = await Promise.all([
    p.query(
      `
      SELECT id, status, plan, billing_cycle
      FROM subscriptions
      WHERE tenant_id=$1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId]
    ),
    p.query(
      `
      SELECT id, status, due_at, paid_at
      FROM invoices
      WHERE tenant_id=$1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId]
    )
  ]);
  const subscription = subResult.rows?.[0];
  const invoice = invoiceResult.rows?.[0];
  if (!subscription || !invoice) return;

  const now = new Date();
  const dueAt = parseDateOrNull(invoice.due_at);
  const nextSubStatus = subscriptionStatusFromInvoice(
    String(invoice.status || ""),
    dueAt,
    now,
    Number(env.HSP_BILLING_GRACE_DAYS || 0)
  );
  if (String(subscription.status || "") !== nextSubStatus) {
    await p.query("UPDATE subscriptions SET status=$2, updated_at=NOW() WHERE id=$1", [String(subscription.id), nextSubStatus]);
  }

  const nextLicenseStatus = nextSubStatus === "active" ? "active" : nextSubStatus === "cancelled" ? "expired" : "suspended";
  await p.query(
    `
    UPDATE licenses
    SET status=$2
    WHERE tenant_id=$1
      AND id IN (
        SELECT id FROM licenses
        WHERE tenant_id=$1
        ORDER BY created_at DESC
        LIMIT 1
      )
    `,
    [tenantId, nextLicenseStatus]
  );
}

async function applyBillingPolicies(): Promise<void> {
  const p = pool();
  await p.query(
    `
    UPDATE invoices
    SET status='overdue', updated_at=NOW()
    WHERE status='pending'
      AND due_at IS NOT NULL
      AND due_at < NOW()
    `
  );
  const tenants = await p.query(
    `
    SELECT DISTINCT tenant_id
    FROM invoices
    WHERE tenant_id IS NOT NULL
    `
  );
  for (const row of tenants.rows || []) {
    const tenantId = String(row.tenant_id || "").trim();
    if (!tenantId) continue;
    await syncTenantSubscriptionByBilling(tenantId);
  }
}

async function saveBillingEvent(
  tenantId: string | null,
  status: string,
  amountCents: number,
  currency: string,
  reason: string
): Promise<void> {
  const p = pool();
  await p.query(
    "INSERT INTO billing_events (id, tenant_id, status, amount_cents, currency, reason) VALUES ($1,$2,$3,$4,$5,$6)",
    [id("bil"), tenantId, status, Math.max(0, Math.round(amountCents || 0)), String(currency || "BRL").toUpperCase(), reason]
  );
}

function normalizeMobileConnect(input: any): MobileConnectSettings {
  const modeRaw = String(input?.mode || MOBILE_CONNECT_DEFAULTS.mode).trim().toLowerCase();
  const mode: MobileConnectMode =
    modeRaw === "lan" ? "lan" : modeRaw === "custom" ? "custom" : "local";
  const lanHost = String(input?.lanHost || "").trim();
  const customBaseUrl = String(input?.customBaseUrl || "").trim().replace(/\/+$/, "");
  const token = String(input?.token || MOBILE_CONNECT_DEFAULTS.token).trim();
  const apiPortRaw = Number(input?.apiPort || MOBILE_CONNECT_DEFAULTS.apiPort);
  const apiPort = Number.isFinite(apiPortRaw) && apiPortRaw >= 1 && apiPortRaw <= 65535 ? Math.floor(apiPortRaw) : 8502;

  return {
    mode,
    lanHost,
    apiPort,
    customBaseUrl,
    token
  };
}

function resolveMobileBaseUrl(cfg: MobileConnectSettings): string {
  if (cfg.mode === "custom") return cfg.customBaseUrl || "";
  if (cfg.mode === "lan") {
    if (!cfg.lanHost) return "";
    return `http://${cfg.lanHost}:${cfg.apiPort}`;
  }
  return `http://localhost:${cfg.apiPort}`;
}

async function loadMobileConnectSettings(): Promise<MobileConnectSettings> {
  const p = pool();
  const row = await p.query("SELECT value_json FROM system_settings WHERE key=$1 LIMIT 1", [MOBILE_CONNECT_KEY]);
  if ((row.rowCount || 0) === 0) return { ...MOBILE_CONNECT_DEFAULTS };
  try {
    const parsed = JSON.parse(String(row.rows?.[0]?.value_json || "{}"));
    return normalizeMobileConnect({ ...MOBILE_CONNECT_DEFAULTS, ...parsed });
  } catch {
    return { ...MOBILE_CONNECT_DEFAULTS };
  }
}

async function saveMobileConnectSettings(cfg: MobileConnectSettings): Promise<void> {
  const p = pool();
  await p.query(
    `
    INSERT INTO system_settings (key, value_json, updated_at)
    VALUES ($1,$2,NOW())
    ON CONFLICT (key)
    DO UPDATE SET value_json=EXCLUDED.value_json, updated_at=NOW()
    `,
    [MOBILE_CONNECT_KEY, JSON.stringify(cfg)]
  );
}

app.get("/api/public/config", (_req, res) => {
  const master = masterEmail();
  return res.json({
    ok: true,
    masterMode: !!master,
    masterEmailHint: master ? maskEmail(master) : "",
    masterEmail: master || ""
  });
});

app.get("/api/public/bootstrap-status", async (_req, res) => {
  try {
    const p = pool();
    const users = await p.query("SELECT COUNT(1)::int AS count FROM users");
    const count = Number(users.rows?.[0]?.count || 0);
    const master = masterEmail();
    return res.json({
      ok: true,
      usersCount: count,
      requiresBootstrap: count === 0,
      bootstrapLocked: count > 0,
      masterMode: !!master,
      masterEmailHint: master ? maskEmail(master) : ""
    });
  } catch {
    return sendError(res, 500, "Falha ao verificar bootstrap.", "BOOTSTRAP_STATUS_ERROR");
  }
});

app.get("/api/public/plans", (_req, res) => {
  const plans = PLAN_VALUES.map((plan) => ({
    plan,
    features: planFeatures(plan),
    cycles: BILLING_CYCLE_VALUES.map((cycle) => ({
      cycle,
      ...planOffer(plan, cycle)
    }))
  }));
  return res.json({ ok: true, plans, billingCycles: BILLING_CYCLE_VALUES });
});

app.get("/api/admin/plans", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const plans = PLAN_VALUES.map((plan) => ({
      plan,
      features: planFeatures(plan),
      cycles: BILLING_CYCLE_VALUES.map((cycle) => ({
        cycle,
        ...planOffer(plan, cycle)
      }))
    }));
    return res.json({ ok: true, plans, billingCycles: BILLING_CYCLE_VALUES });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar catálogo de planos.", "PLANS_ERROR");
    }
    return;
  }
});

app.post("/api/public/register-request", async (req, res) => {
  try {
    const fullName = String(req.body?.fullName || "").trim();
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const requestedPlan = normalizePlan(req.body?.plan, "starter");
    const requestedCycle = normalizeBillingCycle(req.body?.billingCycle, "monthly");
    const objective = String(req.body?.objective || "").trim();
    if (fullName.length < 3) {
      return sendError(res, 400, "Informe seu nome completo para cadastro.", "REGISTER_NAME_INVALID");
    }
    if (!email.includes("@")) {
      return sendError(res, 400, "Informe um e-mail válido.", "REGISTER_EMAIL_INVALID");
    }
    if (password.length < 8) {
      return sendError(res, 400, "A senha deve ter no mínimo 8 caracteres.", "REGISTER_PASSWORD_INVALID");
    }

    const p = pool();
    const [existingUser, existingPending] = await Promise.all([
      p.query("SELECT id FROM users WHERE email=$1 LIMIT 1", [email]),
      p.query("SELECT id FROM onboarding_requests WHERE email=$1 AND status='pending' LIMIT 1", [email])
    ]);
    if ((existingUser.rowCount || 0) > 0) {
      return sendError(res, 409, "Este e-mail já possui acesso ativo.", "REGISTER_EMAIL_ALREADY_ACTIVE");
    }
    if ((existingPending.rowCount || 0) > 0) {
      return sendError(res, 409, "Já existe uma solicitação pendente para este e-mail.", "REGISTER_REQUEST_ALREADY_PENDING");
    }

    const requestId = id("req");
    const passwordHash = await hashPassword(password);
    await p.query(
      `
      INSERT INTO onboarding_requests (
        id, full_name, email, password_hash, requested_plan, requested_cycle, objective, status, payment_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,'pending','pending')
      `,
      [requestId, fullName, email, passwordHash, requestedPlan, requestedCycle, objective]
    );
    await writeAudit("onboarding_request_created", {
      detail: { requestId, email, requestedPlan, requestedCycle }
    });
    return res.json({
      ok: true,
      requestId,
      status: "pending",
      message: "Cadastro recebido. Aguarde aprovação do administrador para liberar seu acesso."
    });
  } catch {
    return sendError(res, 500, "Falha ao registrar sua solicitação.", "REGISTER_REQUEST_ERROR");
  }
});

app.post("/api/bootstrap-admin", async (req, res) => {
  try {
    const bootstrapCode = String(req.body?.bootstrapCode || "");
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    if (bootstrapCode !== env.HSP_BOOTSTRAP_CODE) {
      return sendError(res, 403, "Codigo de bootstrap invalido.", "BOOTSTRAP_CODE_INVALID");
    }
    if (!email.includes("@") || password.length < 8) {
      return sendError(res, 400, "Preencha email valido e senha com no minimo 8 caracteres.", "BOOTSTRAP_INPUT_INVALID");
    }
    const master = masterEmail();
    if (master && email !== master) {
      return sendError(res, 403, "Email diferente do master configurado no servidor.", "MASTER_EMAIL_MISMATCH");
    }
    const p = pool();
    const anyUser = await p.query("SELECT 1 FROM users LIMIT 1");
    if ((anyUser.rowCount || 0) > 0) {
      return sendError(res, 409, "Bootstrap ja concluido.", "BOOTSTRAP_ALREADY_DONE");
    }
    const userId = id("usr");
    const passwordHash = await hashPassword(password);
    await p.query("INSERT INTO users (id, email, password_hash, role, totp_enabled) VALUES ($1,$2,$3,'admin',FALSE)", [
      userId,
      email,
      passwordHash
    ]);
    await writeAudit("bootstrap_admin_created", { userId, detail: { email } });
    return res.json({ ok: true, userId });
  } catch {
    return sendError(res, 500, "Falha no bootstrap inicial.", "BOOTSTRAP_ERROR");
  }
});

app.post("/api/totp/setup-start", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const p = pool();
    const result = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user) return sendError(res, 401, "Credenciais invalidas.", "LOGIN_INVALID");
    const okPassword = await verifyPassword(password, String(user.password_hash));
    if (!okPassword) return sendError(res, 401, "Credenciais invalidas.", "LOGIN_INVALID");
    if (user.totp_enabled) return sendError(res, 409, "2FA ja esta ativo para este usuario.", "TOTP_ALREADY_ENABLED");

    const { secret } = generateTotpSecret();
    const otpauth = totpOtpAuthUrl({ issuer: "HelpSystem Pro", label: String(user.email || user.id), secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
    await p.query("UPDATE users SET totp_secret_enc=$1 WHERE id=$2", [encryptText(secret), String(user.id)]);

    await writeAudit("totp_setup_start", { userId: String(user.id) });
    return res.json({ ok: true, otpauth, qrDataUrl });
  } catch {
    return sendError(res, 500, "Falha ao iniciar setup do 2FA.", "TOTP_SETUP_ERROR");
  }
});

app.post("/api/totp/enable", async (req, res) => {
  try {
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const code = String(req.body?.code || "");
    const p = pool();
    const result = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user) return sendError(res, 401, "Credenciais invalidas.", "LOGIN_INVALID");
    const okPassword = await verifyPassword(password, String(user.password_hash));
    if (!okPassword) return sendError(res, 401, "Credenciais invalidas.", "LOGIN_INVALID");
    if (user.totp_enabled) return res.json({ ok: true, alreadyEnabled: true });
    if (!user.totp_secret_enc) return sendError(res, 428, "Inicie o setup 2FA antes da ativacao.", "TOTP_SETUP_REQUIRED");

    const secret = decryptText(String(user.totp_secret_enc));
    if (!totpVerify(secret, code)) return sendError(res, 401, "Codigo TOTP invalido.", "TOTP_CODE_INVALID");

    await p.query("UPDATE users SET totp_enabled=TRUE WHERE id=$1", [String(user.id)]);
    await writeAudit("totp_enabled", { userId: String(user.id) });
    return res.json({ ok: true });
  } catch {
    return sendError(res, 500, "Falha ao ativar 2FA.", "TOTP_ENABLE_ERROR");
  }
});

app.post("/api/login", async (req, res) => {
  try {
    await applyBillingPolicies();
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const totp = String(req.body?.totp || "");
    const p = pool();
    const result = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [email]);
    const user = result.rows[0];
    if (!user) return sendError(res, 401, "Credenciais invalidas.", "LOGIN_INVALID");
    const okPassword = await verifyPassword(password, String(user.password_hash));
    if (!okPassword) return sendError(res, 401, "Credenciais invalidas.", "LOGIN_INVALID");

    if (!user.totp_enabled) {
      return sendError(res, 428, "2FA obrigatorio. Conclua onboarding de seguranca.", "TOTP_REQUIRED");
    }
    if (!user.totp_secret_enc) {
      return sendError(res, 428, "2FA inconsistente. Refaca setup de seguranca.", "TOTP_SETUP_REQUIRED");
    }

    const master = masterEmail();
    if (master && String(user.role || "") === "admin" && normEmail(user.email) !== master) {
      return sendError(res, 403, "Conta admin reservada ao master.", "MASTER_ONLY_ADMIN");
    }

    const secret = decryptText(String(user.totp_secret_enc));
    if (!totpVerify(secret, totp)) return sendError(res, 401, "Codigo TOTP invalido.", "TOTP_CODE_INVALID");

    const tenantResult = await p.query("SELECT tenant_id FROM user_tenants WHERE user_id=$1", [String(user.id)]);
    const tenantIds = tenantResult.rows.map((row: any) => String(row.tenant_id));
    const token = signJwt({
      sub: String(user.id),
      role: String(user.role) === "admin" ? "admin" : "user",
      tenantIds
    });

    await writeAudit("login_success", { userId: String(user.id), detail: { role: user.role } });
    return res.json({ ok: true, token, role: user.role, tenantIds });
  } catch {
    return sendError(res, 500, "Falha no login.", "LOGIN_ERROR");
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    const p = pool();
    const meResult = await p.query("SELECT id, email, role, totp_enabled, created_at FROM users WHERE id=$1", [auth.id]);
    const tenantsResult = await p.query(
      `
      SELECT t.id, t.plan,
             s.status AS subscription_status
      FROM user_tenants ut
      JOIN tenants t ON t.id = ut.tenant_id
      LEFT JOIN LATERAL (
        SELECT status
        FROM subscriptions ss
        WHERE ss.tenant_id = t.id
        ORDER BY ss.created_at DESC
        LIMIT 1
      ) s ON TRUE
      WHERE ut.user_id=$1
      `,
      [auth.id]
    );
    const tenants = (tenantsResult.rows || []).map((row: any) => ({
      id: row.id,
      plan: row.plan,
      subscription_status: row.subscription_status || "active",
      features: planFeatures(normalizePlan(row.plan, "starter"))
    }));
    return res.json({ ok: true, user: meResult.rows?.[0] || null, tenantIds: auth.tenantIds || [], tenants });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar dados do usuario.", "ME_ERROR");
    }
    return;
  }
});

app.get("/api/billing/status", async (req, res) => {
  try {
    const auth = requireAuth(req, res);
    await applyBillingPolicies();
    const p = pool();
    const tenantFilter = String(req.query?.tenantId || "").trim();
    const rows = await p.query(
      `
      SELECT t.id AS tenant_id, t.name, t.plan AS tenant_plan, t.status AS tenant_status,
             s.status AS subscription_status, s.expires_at, s.plan AS subscription_plan, s.billing_cycle,
             i.id AS invoice_id, i.status AS invoice_status, i.amount_cents, i.currency, i.due_at, i.paid_at
      FROM user_tenants ut
      JOIN tenants t ON t.id = ut.tenant_id
      LEFT JOIN LATERAL (
        SELECT *
        FROM subscriptions ss
        WHERE ss.tenant_id = t.id
        ORDER BY ss.created_at DESC
        LIMIT 1
      ) s ON TRUE
      LEFT JOIN LATERAL (
        SELECT *
        FROM invoices ii
        WHERE ii.tenant_id = t.id
        ORDER BY ii.created_at DESC
        LIMIT 1
      ) i ON TRUE
      WHERE ut.user_id = $1
        AND ($2 = '' OR t.id = $2)
      ORDER BY t.created_at DESC
      `,
      [auth.id, tenantFilter]
    );
    const normalized = rows.rows.map((row: any) => {
      const subscriptionStatus = String(row.subscription_status || "").toLowerCase();
      const invoiceStatus = String(row.invoice_status || "").toLowerCase();
      const plan = normalizePlan(row.subscription_plan || row.tenant_plan, "starter");
      const blockedBySubscription = subscriptionStatus === "suspended" || subscriptionStatus === "cancelled";
      const blockedByBilling = invoiceStatus === "overdue" || invoiceStatus === "failed" || invoiceStatus === "suspended";
      return {
        ...row,
        features: planFeatures(plan),
        can_live: !blockedBySubscription && !blockedByBilling,
        live_block_reason: blockedBySubscription
          ? `Assinatura ${subscriptionStatus}.`
          : blockedByBilling
            ? `Cobrança ${invoiceStatus}.`
            : ""
      };
    });
    return res.json({ ok: true, rows: normalized });
  } catch {
    return sendError(res, 500, "Falha ao carregar status de cobranca.", "BILLING_STATUS_ERROR");
  }
});

app.post("/api/billing/webhook/:provider", async (req, res) => {
  const providerName = String(req.params.provider || "").trim().toLowerCase();
  if (providerName !== billingProvider.name) {
    return sendError(res, 404, "Provedor de webhook não suportado.", "BILLING_PROVIDER_NOT_SUPPORTED");
  }
  try {
    const normalized = billingProvider.normalizeWebhook(req.body || {}, normalizeHeaders(req.headers as any));
    const p = pool();
    const webhookId = id("whk");
    try {
      await p.query(
        "INSERT INTO payment_webhooks (id, provider, event_id, payload, status) VALUES ($1,$2,$3,$4,$5)",
        [webhookId, normalized.provider, normalized.eventId, toJsonSafe(normalized.raw), "received"]
      );
    } catch (err) {
      if (isPgUniqueViolation(err)) {
        return res.json({ ok: true, duplicated: true, eventId: normalized.eventId });
      }
      throw err;
    }

    const payment = await billingProvider.fetchPaymentStatus(normalized.paymentExternalId);
    const invoiceResult = await p.query(
      `
      SELECT id, tenant_id, status, amount_cents, currency
      FROM invoices
      WHERE external_id=$1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [payment.externalId]
    );
    const invoice = invoiceResult.rows?.[0];
    if (!invoice) {
      await p.query("UPDATE payment_webhooks SET status='ignored', processed_at=NOW() WHERE id=$1", [webhookId]);
      return res.json({ ok: true, processed: false, reason: "invoice_not_found", eventId: normalized.eventId });
    }

    await p.query(
      `
      UPDATE invoices
      SET status=$2,
          paid_at=$3,
          external_payload=$4,
          updated_at=NOW()
      WHERE id=$1
      `,
      [String(invoice.id), payment.invoiceStatus, payment.paidAt ? new Date(payment.paidAt) : null, toJsonSafe(payment.raw)]
    );
    await saveBillingEvent(
      String(invoice.tenant_id),
      payment.invoiceStatus === "paid" ? "paid" : payment.invoiceStatus === "failed" ? "failed" : "pending",
      Number(invoice.amount_cents || 0),
      String(invoice.currency || "BRL"),
      `invoice_${payment.invoiceStatus}`
    );
    await syncTenantSubscriptionByBilling(String(invoice.tenant_id));
    await p.query("UPDATE payment_webhooks SET status='processed', processed_at=NOW() WHERE id=$1", [webhookId]);
    await writeAudit("billing_webhook_processed", {
      tenantId: String(invoice.tenant_id),
      detail: {
        provider: normalized.provider,
        eventId: normalized.eventId,
        invoiceId: invoice.id,
        invoiceStatus: payment.invoiceStatus
      }
    });
    return res.json({ ok: true, processed: true, eventId: normalized.eventId, invoiceId: invoice.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Falha ao processar webhook de cobrança.";
    return sendError(res, 400, message, "BILLING_WEBHOOK_ERROR");
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const users = await p.query("SELECT id, email, role, totp_enabled, created_at FROM users ORDER BY created_at DESC LIMIT 500");
    return res.json({ ok: true, rows: users.rows });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar usuarios.", "USERS_LIST_ERROR");
    }
    return;
  }
});

app.post("/api/admin/users", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const email = normEmail(req.body?.email);
    const password = String(req.body?.password || "");
    const requestedRole = String(req.body?.role || "user");
    if (!email.includes("@") || password.length < 8) {
      return sendError(res, 400, "Dados invalidos para criar usuario.", "USER_CREATE_INVALID");
    }
    const master = masterEmail();
    const role = requestedRole === "admin" ? "admin" : "user";
    if (master && role === "admin") {
      return sendError(res, 403, "Apenas o master configurado pode ser admin.", "MASTER_ONLY_ADMIN");
    }

    const p = pool();
    const userId = id("usr");
    const passwordHash = await hashPassword(password);
    await p.query("INSERT INTO users (id, email, password_hash, role, totp_enabled) VALUES ($1,$2,$3,$4,FALSE)", [
      userId,
      email,
      passwordHash,
      role
    ]);
    await writeAudit("admin_user_created", {
      userId: auth.id,
      detail: { createdUserId: userId, email, role }
    });
    return res.json({ ok: true, userId });
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return sendError(res, 409, "Ja existe um usuario com este email.", "USER_EMAIL_EXISTS");
    }
    return sendError(res, 500, "Falha ao criar usuario.", "USER_CREATE_ERROR");
  }
});

app.get("/api/admin/tenants", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const tenants = await p.query("SELECT id, name, plan, status, created_at FROM tenants ORDER BY created_at DESC LIMIT 500");
    return res.json({ ok: true, rows: tenants.rows });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar clientes.", "TENANTS_LIST_ERROR");
    }
    return;
  }
});

app.post("/api/admin/tenants", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const name = String(req.body?.name || "").trim();
    const plan = normalizePlan(req.body?.plan, "starter");
    const billingCycle = normalizeBillingCycle(req.body?.billingCycle, "monthly");
    if (name.length < 2) return sendError(res, 400, "Nome do cliente invalido.", "TENANT_CREATE_INVALID");

    const p = pool();
    const tenantId = id("tnt");
    const subscriptionId = id("sub");
    const licenseId = id("lic");
    const billingEventId = id("bil");
    const now = new Date();
    const expiresAt = addDays(now, cycleDurationDays(billingCycle));
    const offer = planOffer(plan, billingCycle);

    await p.query("INSERT INTO tenants (id, name, plan, status) VALUES ($1,$2,$3,'active')", [tenantId, name, plan]);
    await p.query(
      "INSERT INTO subscriptions (id, tenant_id, plan, billing_cycle, status, start_date, expires_at) VALUES ($1,$2,$3,$4,'active',NOW(),$5)",
      [subscriptionId, tenantId, plan, billingCycle, expiresAt]
    );
    await p.query("INSERT INTO licenses (id, tenant_id, plan, billing_cycle, status, expires_at) VALUES ($1,$2,$3,$4,'active',$5)", [
      licenseId,
      tenantId,
      plan,
      billingCycle,
      expiresAt
    ]);
    await p.query("INSERT INTO bot_status (tenant_id, is_online, last_seen) VALUES ($1,FALSE,NULL) ON CONFLICT DO NOTHING", [tenantId]);
    await p.query(
      "INSERT INTO billing_events (id, tenant_id, status, amount_cents, currency, reason) VALUES ($1,$2,'paid',$3,$4,$5)",
      [billingEventId, tenantId, offer.amountCents, offer.currency, `tenant_created_${billingCycle}`]
    );

    await writeAudit("tenant_created", {
      userId: auth.id,
      tenantId,
      detail: { tenantId, name, plan, billingCycle, subscriptionId, licenseId }
    });
    return res.json({ ok: true, tenantId, subscriptionId, licenseId });
  } catch {
    return sendError(res, 500, "Falha ao criar cliente.", "TENANT_CREATE_ERROR");
  }
});

app.get("/api/admin/links", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const links = await p.query(
      `
      SELECT ut.user_id, ut.tenant_id, u.email AS user_email, t.name AS tenant_name, t.plan AS tenant_plan
      FROM user_tenants ut
      JOIN users u ON u.id = ut.user_id
      JOIN tenants t ON t.id = ut.tenant_id
      ORDER BY u.email ASC, t.name ASC
      LIMIT 1000
      `
    );
    return res.json({ ok: true, rows: links.rows });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar vinculos usuario-cliente.", "LINKS_LIST_ERROR");
    }
    return;
  }
});

app.post("/api/admin/grant", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const userId = String(req.body?.userId || "").trim();
    const tenantId = String(req.body?.tenantId || "").trim();
    if (!userId || !tenantId) return sendError(res, 400, "Selecione usuario e cliente para vincular.", "GRANT_INVALID");
    const p = pool();
    await p.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [userId, tenantId]);
    await writeAudit("tenant_granted", { userId: auth.id, tenantId, detail: { userId, tenantId } });
    return res.json({ ok: true });
  } catch (err) {
    if (isPgForeignKeyViolation(err)) {
      return sendError(res, 404, "Usuario ou cliente nao encontrado para vinculo.", "GRANT_TARGET_NOT_FOUND");
    }
    return sendError(res, 500, "Falha ao vincular usuario ao cliente.", "GRANT_ERROR");
  }
});

app.get("/api/admin/registration-requests", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const rows = await p.query(
      `
      SELECT id, full_name, email, requested_plan, requested_cycle, objective, status,
             payment_status, payment_method, payment_reference, notes,
             approved_tenant_id, approved_user_id, approved_by_user_id, approved_at,
             created_at, updated_at
      FROM onboarding_requests
      ORDER BY created_at DESC
      LIMIT 1000
      `
    );
    return res.json({ ok: true, rows: rows.rows });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar solicitações de cadastro.", "REGISTRATION_REQUESTS_ERROR");
    }
    return;
  }
});

app.post("/api/admin/registration-requests/:id/payment", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const requestId = String(req.params.id || "").trim();
    const paymentStatus = normalizeEnum(req.body?.paymentStatus, REQUEST_PAYMENT_STATUS_VALUES, "pending");
    const paymentMethod = String(req.body?.paymentMethod || "").trim();
    const paymentReference = String(req.body?.paymentReference || "").trim();
    const notes = String(req.body?.notes || "").trim();
    if (!requestId) return sendError(res, 400, "Solicitação inválida para atualização de pagamento.", "REGISTRATION_REQUEST_INVALID");

    const p = pool();
    const result = await p.query(
      `
      UPDATE onboarding_requests
      SET payment_status=$2, payment_method=$3, payment_reference=$4, notes=$5, updated_at=NOW()
      WHERE id=$1
      RETURNING id
      `,
      [requestId, paymentStatus, paymentMethod, paymentReference, notes]
    );
    if ((result.rowCount || 0) === 0) {
      return sendError(res, 404, "Solicitação de cadastro não encontrada.", "REGISTRATION_REQUEST_NOT_FOUND");
    }
    await writeAudit("onboarding_request_payment_updated", {
      userId: auth.id,
      detail: { requestId, paymentStatus, paymentMethod }
    });
    return res.json({ ok: true });
  } catch {
    return sendError(res, 500, "Falha ao atualizar pagamento da solicitação.", "REGISTRATION_REQUEST_PAYMENT_ERROR");
  }
});

app.post("/api/admin/registration-requests/:id/approve", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const requestId = String(req.params.id || "").trim();
    if (!requestId) return sendError(res, 400, "Solicitação inválida para aprovação.", "REGISTRATION_REQUEST_INVALID");

    const plan = normalizePlan(req.body?.plan, "starter");
    const billingCycle = normalizeBillingCycle(req.body?.billingCycle, "monthly");
    const subscriptionStatus = normalizeEnum(req.body?.subscriptionStatus, ["active", "grace_period", "suspended", "cancelled"] as const, "active");
    const licenseStatus = normalizeEnum(req.body?.licenseStatus, LICENSE_STATUS_VALUES, "active");
    const notes = String(req.body?.notes || "").trim();

    const p = pool();
    const reqResult = await p.query(
      `
      SELECT *
      FROM onboarding_requests
      WHERE id=$1
      LIMIT 1
      `,
      [requestId]
    );
    const requestRow = reqResult.rows?.[0];
    if (!requestRow) return sendError(res, 404, "Solicitação de cadastro não encontrada.", "REGISTRATION_REQUEST_NOT_FOUND");
    if (String(requestRow.status) !== "pending") {
      return sendError(res, 409, "Esta solicitação já foi processada.", "REGISTRATION_REQUEST_ALREADY_PROCESSED");
    }
    if (String(requestRow.payment_status) !== "paid") {
      return sendError(res, 409, "Aprovação bloqueada: pagamento ainda não confirmado.", "REGISTRATION_REQUEST_PAYMENT_PENDING");
    }
    const email = normEmail(requestRow.email);
    const fullName = String(requestRow.full_name || "").trim();
    const passwordHash = String(requestRow.password_hash || "");
    if (!email || !passwordHash) {
      return sendError(res, 400, "Solicitação inválida: dados de usuário ausentes.", "REGISTRATION_REQUEST_DATA_INVALID");
    }

    const existingUser = await p.query("SELECT id FROM users WHERE email=$1 LIMIT 1", [email]);
    if ((existingUser.rowCount || 0) > 0) {
      return sendError(res, 409, "Já existe usuário ativo com este e-mail.", "REGISTRATION_REQUEST_USER_EXISTS");
    }

    const tenantId = id("tnt");
    const userId = id("usr");
    const subscriptionId = id("sub");
    const licenseId = id("lic");
    const billingEventId = id("bil");
    const now = new Date();
    const expiresAt = addDays(now, cycleDurationDays(billingCycle));
    const offer = planOffer(plan, billingCycle);
    const tenantName = fullName ? `${fullName} (${email})` : email;

    await p.query("BEGIN");
    try {
      await p.query("INSERT INTO tenants (id, name, plan, status) VALUES ($1,$2,$3,'active')", [tenantId, tenantName, plan]);
      await p.query(
        "INSERT INTO subscriptions (id, tenant_id, plan, billing_cycle, status, start_date, expires_at) VALUES ($1,$2,$3,$4,$5,NOW(),$6)",
        [subscriptionId, tenantId, plan, billingCycle, subscriptionStatus, expiresAt]
      );
      await p.query(
        "INSERT INTO licenses (id, tenant_id, plan, billing_cycle, status, expires_at) VALUES ($1,$2,$3,$4,$5,$6)",
        [licenseId, tenantId, plan, billingCycle, licenseStatus, expiresAt]
      );
      await p.query(
        "INSERT INTO users (id, email, password_hash, role, totp_enabled) VALUES ($1,$2,$3,'user',FALSE)",
        [userId, email, passwordHash]
      );
      await p.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1,$2)", [userId, tenantId]);
      await p.query("INSERT INTO bot_status (tenant_id, is_online, last_seen) VALUES ($1,FALSE,NULL) ON CONFLICT DO NOTHING", [tenantId]);
      await p.query(
        "INSERT INTO billing_events (id, tenant_id, status, amount_cents, currency, reason) VALUES ($1,$2,'paid',$3,$4,$5)",
        [billingEventId, tenantId, offer.amountCents, offer.currency, `onboarding_${billingCycle}`]
      );
      await p.query(
        `
        UPDATE onboarding_requests
        SET status='approved',
            requested_plan=$2,
            requested_cycle=$3,
            notes=$4,
            approved_tenant_id=$5,
            approved_user_id=$6,
            approved_by_user_id=$7,
            approved_at=NOW(),
            updated_at=NOW()
        WHERE id=$1
        `,
        [requestId, plan, billingCycle, notes, tenantId, userId, auth.id]
      );
      await p.query("COMMIT");
    } catch (err) {
      await p.query("ROLLBACK");
      throw err;
    }

    await writeAudit("onboarding_request_approved", {
      userId: auth.id,
      tenantId,
      detail: { requestId, tenantId, userId, plan, billingCycle, subscriptionStatus, licenseStatus }
    });
    return res.json({
      ok: true,
      tenantId,
      userId,
      login: {
        email,
        needs2faSetup: true
      },
      billing: offer
    });
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      return sendError(res, 409, "Conflito ao aprovar solicitação. Atualize a tela e tente novamente.", "REGISTRATION_REQUEST_CONFLICT");
    }
    return sendError(res, 500, "Falha ao aprovar solicitação de cadastro.", "REGISTRATION_REQUEST_APPROVE_ERROR");
  }
});

app.post("/api/admin/registration-requests/:id/reject", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const requestId = String(req.params.id || "").trim();
    const notes = String(req.body?.notes || "").trim();
    if (!requestId) return sendError(res, 400, "Solicitação inválida para rejeição.", "REGISTRATION_REQUEST_INVALID");
    const p = pool();
    const result = await p.query(
      `
      UPDATE onboarding_requests
      SET status='rejected', notes=$2, updated_at=NOW()
      WHERE id=$1 AND status='pending'
      RETURNING id
      `,
      [requestId, notes]
    );
    if ((result.rowCount || 0) === 0) {
      return sendError(res, 409, "Solicitação já processada ou inexistente.", "REGISTRATION_REQUEST_REJECT_INVALID");
    }
    await writeAudit("onboarding_request_rejected", {
      userId: auth.id,
      detail: { requestId, notes }
    });
    return res.json({ ok: true });
  } catch {
    return sendError(res, 500, "Falha ao rejeitar solicitação de cadastro.", "REGISTRATION_REQUEST_REJECT_ERROR");
  }
});

app.get("/api/admin/subscribers", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const subscribers = await p.query(
      `
      SELECT u.id AS user_id,
             u.email,
             u.role,
             u.totp_enabled,
             t.id AS tenant_id,
             t.name AS tenant_name,
             t.plan AS tenant_plan,
             t.status AS tenant_status,
             s.status AS subscription_status,
             s.billing_cycle AS subscription_billing_cycle,
             s.expires_at AS subscription_expires_at
      FROM user_tenants ut
      JOIN users u ON u.id = ut.user_id
      JOIN tenants t ON t.id = ut.tenant_id
      LEFT JOIN LATERAL (
        SELECT status, billing_cycle, expires_at
        FROM subscriptions ss
        WHERE ss.tenant_id = t.id
        ORDER BY ss.created_at DESC
        LIMIT 1
      ) s ON TRUE
      ORDER BY u.created_at DESC
      LIMIT 1000
      `
    );
    return res.json({ ok: true, rows: subscribers.rows });
  } catch {
    return sendError(res, 500, "Falha ao carregar assinantes.", "SUBSCRIBERS_ERROR");
  }
});

app.get("/api/admin/licenses", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const rows = await p.query(
      `
      SELECT l.id, l.tenant_id, t.name AS tenant_name, l.plan, l.billing_cycle, l.status, l.expires_at, l.machine_hash, l.created_at
      FROM licenses l
      JOIN tenants t ON t.id = l.tenant_id
      ORDER BY l.created_at DESC
      LIMIT 1000
      `
    );
    return res.json({ ok: true, rows: rows.rows });
  } catch {
    return sendError(res, 500, "Falha ao carregar licencas.", "LICENSES_ERROR");
  }
});

app.post("/api/admin/licenses", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const tenantId = String(req.body?.tenantId || "").trim();
    const plan = normalizePlan(req.body?.plan, "starter");
    const billingCycle = normalizeBillingCycle(req.body?.billingCycle, "monthly");
    const status = normalizeEnum(req.body?.status, LICENSE_STATUS_VALUES, "active");
    const machineHash = String(req.body?.machineHash || "").trim();
    const expiresAtRaw = req.body?.expiresAt ? new Date(String(req.body.expiresAt)) : null;
    const expiresAt = expiresAtRaw && !Number.isNaN(expiresAtRaw.getTime()) ? expiresAtRaw : null;
    if (!tenantId) return sendError(res, 400, "Selecione um cliente para a licenca.", "LICENSE_INVALID");
    const p = pool();
    const licenseId = id("lic");
    await p.query(
      "INSERT INTO licenses (id, tenant_id, plan, billing_cycle, status, expires_at, machine_hash) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [licenseId, tenantId, plan, billingCycle, status, expiresAt, machineHash || null]
    );
    await writeAudit("license_created", {
      userId: auth.id,
      tenantId,
      detail: { licenseId, tenantId, plan, billingCycle, status, expiresAt }
    });
    return res.json({ ok: true, licenseId });
  } catch (err) {
    if (isPgForeignKeyViolation(err)) {
      return sendError(res, 404, "Cliente nao encontrado para registrar licenca.", "LICENSE_TENANT_NOT_FOUND");
    }
    return sendError(res, 500, "Falha ao salvar licenca.", "LICENSE_CREATE_ERROR");
  }
});

app.get("/api/admin/billing", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    await applyBillingPolicies();
    const p = pool();
    const rows = await p.query(
      `
      SELECT b.id, b.tenant_id, t.name AS tenant_name, b.status, b.amount_cents, b.currency, b.reason, b.created_at
      FROM billing_events b
      LEFT JOIN tenants t ON t.id = b.tenant_id
      ORDER BY b.created_at DESC
      LIMIT 1000
      `
    );
    return res.json({ ok: true, rows: rows.rows });
  } catch {
    return sendError(res, 500, "Falha ao carregar cobranca.", "BILLING_ERROR");
  }
});

app.get("/api/admin/billing/invoices", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    await applyBillingPolicies();
    const tenantId = String(req.query?.tenantId || "").trim();
    const status = normalizeEnum(req.query?.status, INVOICE_STATUS_VALUES, "pending");
    const all = String(req.query?.all || "").trim() === "1";
    const p = pool();
    const invoices = await p.query(
      `
      SELECT i.id, i.tenant_id, t.name AS tenant_name, i.subscription_id, i.provider, i.status, i.amount_cents, i.currency,
             i.due_at, i.paid_at, i.external_id, i.external_payload, i.created_at, i.updated_at,
             COALESCE(s.plan, t.plan) AS plan,
             COALESCE(s.billing_cycle, 'monthly') AS billing_cycle
      FROM invoices i
      JOIN tenants t ON t.id = i.tenant_id
      LEFT JOIN subscriptions s ON s.id = i.subscription_id
      WHERE ($1 = '' OR i.tenant_id = $1)
        AND ($2 = TRUE OR i.status = $3)
      ORDER BY i.created_at DESC
      LIMIT 1000
      `,
      [tenantId, all, status]
    );
    const webhooks = await p.query(
      `
      SELECT id, provider, event_id, status, processed_at, created_at
      FROM payment_webhooks
      ORDER BY created_at DESC
      LIMIT 200
      `
    );
    return res.json({ ok: true, rows: invoices.rows, webhooks: webhooks.rows });
  } catch {
    return sendError(res, 500, "Falha ao carregar faturas.", "BILLING_INVOICES_ERROR");
  }
});

app.post("/api/admin/billing/invoices", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    await applyBillingPolicies();
    const tenantId = String(req.body?.tenantId || "").trim();
    if (!tenantId) return sendError(res, 400, "Selecione o cliente para gerar a cobrança.", "BILLING_INVOICE_TENANT_REQUIRED");

    const p = pool();
    const tenantResult = await p.query("SELECT id, name FROM tenants WHERE id=$1 LIMIT 1", [tenantId]);
    const tenant = tenantResult.rows?.[0];
    if (!tenant) return sendError(res, 404, "Cliente não encontrado para cobrança.", "BILLING_TENANT_NOT_FOUND");

    const subscriptionResult = await p.query(
      `
      SELECT id, plan, billing_cycle, status
      FROM subscriptions
      WHERE tenant_id=$1
      ORDER BY created_at DESC
      LIMIT 1
      `,
      [tenantId]
    );
    const subscription = subscriptionResult.rows?.[0];
    const plan = normalizePlan(req.body?.plan || subscription?.plan || "starter", "starter");
    const billingCycle = normalizeBillingCycle(req.body?.billingCycle || subscription?.billing_cycle || "monthly", "monthly");
    const offer = planOffer(plan, billingCycle);
    const currency = String(req.body?.currency || offer.currency || "BRL").trim().toUpperCase() || "BRL";
    const amountRaw = Number(req.body?.amountCents ?? offer.amountCents);
    const amountCents = Number.isFinite(amountRaw) ? Math.max(100, Math.round(amountRaw)) : offer.amountCents;
    const dueAtRaw = parseDateOrNull(req.body?.dueAt);
    const dueAt = dueAtRaw || addDays(new Date(), Number(req.body?.dueInDays || 3));
    const invoiceId = id("inv");
    const payerEmailResult = await p.query(
      `
      SELECT u.email
      FROM user_tenants ut
      JOIN users u ON u.id = ut.user_id
      WHERE ut.tenant_id=$1
      ORDER BY u.created_at ASC
      LIMIT 1
      `,
      [tenantId]
    );
    const payerEmail = normEmail(payerEmailResult.rows?.[0]?.email) || "cliente@helpsystem.local";
    const callbackUrl =
      String(env.HSP_MP_NOTIFICATION_URL || "").trim() ||
      `${String(env.HSP_BASE_URL || "").replace(/\/+$/, "")}/api/billing/webhook/${billingProvider.name}`;
    await p.query(
      `
      INSERT INTO invoices (id, tenant_id, subscription_id, provider, status, amount_cents, currency, due_at, external_payload)
      VALUES ($1,$2,$3,$4,'pending',$5,$6,$7,$8)
      `,
      [invoiceId, tenantId, subscription?.id || null, billingProvider.name, amountCents, currency, dueAt, "{}"]
    );

    let providerInvoice;
    try {
      providerInvoice = await billingProvider.createPixInvoice({
        invoiceId,
        amountCents,
        currency,
        description: `HelpSystem Pro ${plan} ${billingCycle}`,
        payerEmail,
        externalReference: invoiceId,
        notificationUrl: callbackUrl
      });
    } catch (providerError) {
      await p.query(
        "UPDATE invoices SET status='failed', external_payload=$2, updated_at=NOW() WHERE id=$1",
        [invoiceId, toJsonSafe({ error: providerError instanceof Error ? providerError.message : "provider_error" })]
      );
      await saveBillingEvent(tenantId, "failed", amountCents, currency, "invoice_provider_error");
      throw providerError;
    }

    await p.query(
      `
      UPDATE invoices
      SET status=$2,
          external_id=$3,
          external_payload=$4,
          due_at=COALESCE($5, due_at),
          updated_at=NOW()
      WHERE id=$1
      `,
      [invoiceId, providerInvoice.status, providerInvoice.externalId, toJsonSafe(providerInvoice.raw), providerInvoice.expiresAt]
    );
    await saveBillingEvent(tenantId, providerInvoice.status === "paid" ? "paid" : "pending", amountCents, currency, "invoice_created");
    await syncTenantSubscriptionByBilling(tenantId);
    await writeAudit("billing_invoice_created", {
      userId: auth.id,
      tenantId,
      detail: {
        invoiceId,
        plan,
        billingCycle,
        amountCents,
        currency,
        provider: billingProvider.name,
        externalId: providerInvoice.externalId
      }
    });
    return res.json({
      ok: true,
      invoiceId,
      externalId: providerInvoice.externalId,
      tenantId,
      status: providerInvoice.status,
      provider: billingProvider.name,
      amountCents,
      currency,
      dueAt: dueAt.toISOString(),
      pix: {
        copiaECola: providerInvoice.qrCode,
        qrCodeBase64: providerInvoice.qrCodeBase64,
        ticketUrl: providerInvoice.ticketUrl
      }
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Falha ao gerar cobrança PIX.";
    return sendError(res, 500, detail, "BILLING_INVOICE_CREATE_ERROR");
  }
});

app.post("/api/admin/billing/invoices/:id/cancel", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const invoiceId = String(req.params.id || "").trim();
    if (!invoiceId) return sendError(res, 400, "Fatura inválida para cancelamento.", "BILLING_INVOICE_INVALID");
    const p = pool();
    const result = await p.query(
      `
      UPDATE invoices
      SET status='cancelled', updated_at=NOW()
      WHERE id=$1
        AND status IN ('pending','overdue')
      RETURNING id, tenant_id, amount_cents, currency
      `,
      [invoiceId]
    );
    if ((result.rowCount || 0) === 0) {
      return sendError(res, 409, "A fatura já foi processada ou não existe.", "BILLING_INVOICE_CANCEL_INVALID");
    }
    const row = result.rows?.[0];
    await saveBillingEvent(String(row.tenant_id), "failed", Number(row.amount_cents || 0), String(row.currency || "BRL"), "invoice_cancelled");
    await syncTenantSubscriptionByBilling(String(row.tenant_id));
    await writeAudit("billing_invoice_cancelled", {
      userId: auth.id,
      tenantId: String(row.tenant_id),
      detail: { invoiceId }
    });
    return res.json({ ok: true, invoiceId });
  } catch {
    return sendError(res, 500, "Falha ao cancelar fatura.", "BILLING_INVOICE_CANCEL_ERROR");
  }
});

app.post("/api/admin/billing/event", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const tenantId = String(req.body?.tenantId || "").trim();
    const status = normalizeEnum(req.body?.status, BILLING_STATUS_VALUES, "pending");
    const reason = String(req.body?.reason || "").trim();
    const currency = String(req.body?.currency || "BRL").trim().toUpperCase();
    const amountCents = Number(req.body?.amountCents || 0);
    await saveBillingEvent(
      tenantId || null,
      status,
      Number.isFinite(amountCents) ? Math.round(amountCents) : 0,
      currency,
      reason
    );
    if (tenantId) {
      await applyBillingPolicies();
      await syncTenantSubscriptionByBilling(tenantId);
    }
    await writeAudit("billing_event_created", {
      userId: auth.id,
      tenantId: tenantId || null,
      detail: { status, currency, amountCents, reason }
    });
    return res.json({ ok: true });
  } catch (err) {
    if (isPgForeignKeyViolation(err)) {
      return sendError(res, 404, "Cliente nao encontrado para o evento de cobranca.", "BILLING_TENANT_NOT_FOUND");
    }
    return sendError(res, 500, "Falha ao salvar evento de cobranca.", "BILLING_CREATE_ERROR");
  }
});

app.get("/api/admin/audit", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const rows = await p.query(
      `
      SELECT id, ts, user_id, tenant_id, action, detail_json
      FROM audit_log
      ORDER BY ts DESC
      LIMIT 500
      `
    );
    return res.json({ ok: true, rows: rows.rows });
  } catch {
    return sendError(res, 500, "Falha ao carregar auditoria.", "AUDIT_ERROR");
  }
});

app.get("/api/admin/security", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const totalUsers = await p.query("SELECT COUNT(1)::int AS count FROM users");
    const usersWithTotp = await p.query("SELECT COUNT(1)::int AS count FROM users WHERE totp_enabled=TRUE");
    const admins = await p.query("SELECT id, email, created_at FROM users WHERE role='admin' ORDER BY created_at ASC");
    const master = masterEmail();
    return res.json({
      ok: true,
      stats: {
        totalUsers: Number(totalUsers.rows?.[0]?.count || 0),
        usersWith2FA: Number(usersWithTotp.rows?.[0]?.count || 0),
        twoFactorCoveragePct:
          Number(totalUsers.rows?.[0]?.count || 0) > 0
            ? Math.round((Number(usersWithTotp.rows?.[0]?.count || 0) / Number(totalUsers.rows?.[0]?.count || 1)) * 100)
            : 0,
        masterMode: !!master,
        masterEmailHint: master ? maskEmail(master) : ""
      },
      admins: admins.rows
    });
  } catch {
    return sendError(res, 500, "Falha ao carregar dados de seguranca.", "SECURITY_ERROR");
  }
});

app.get("/api/admin/settings", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const userEmail = await currentUserEmail(auth.id);
    const mobileConnect = await loadMobileConnectSettings();
    return res.json({
      ok: true,
      settings: {
        environment: process.env.NODE_ENV || "development",
        baseUrl: env.HSP_BASE_URL,
        apiPort: env.PORT,
        masterMode: !!masterEmail(),
        masterEmailHint: masterEmail() ? maskEmail(masterEmail()) : "",
        operatorEmail: userEmail,
        mobileConnect
      },
      options: {
        plans: PLAN_VALUES,
        planFeatures: PLAN_VALUES.reduce((acc, plan) => ({ ...acc, [plan]: planFeatures(plan) }), {}),
        billingCycles: BILLING_CYCLE_VALUES,
        licenseStatuses: LICENSE_STATUS_VALUES,
        billingStatuses: BILLING_STATUS_VALUES,
        invoiceStatuses: INVOICE_STATUS_VALUES
      },
      mobileConnect: {
        ...mobileConnect,
        baseUrlPreview: resolveMobileBaseUrl(mobileConnect)
      }
    });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar configuracoes do admin.", "ADMIN_SETTINGS_ERROR");
    }
    return;
  }
});

app.get("/api/admin/mobile-connect-settings", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const settings = await loadMobileConnectSettings();
    return res.json({
      ok: true,
      settings,
      baseUrlPreview: resolveMobileBaseUrl(settings)
    });
  } catch {
    if (!res.headersSent) {
      return sendError(res, 500, "Falha ao carregar configuracao mobile.", "MOBILE_CONNECT_READ_ERROR");
    }
    return;
  }
});

app.post("/api/admin/mobile-connect-settings", async (req, res) => {
  try {
    const auth = await requireMasterAdmin(req, res);
    const next = normalizeMobileConnect(req.body || {});

    if (next.mode === "lan" && !next.lanHost) {
      return sendError(res, 400, "No modo LAN, informe o IP/host da API.", "MOBILE_CONNECT_LAN_HOST_REQUIRED");
    }
    if (next.mode === "custom" && !next.customBaseUrl) {
      return sendError(res, 400, "No modo URL personalizada, informe a URL base da API.", "MOBILE_CONNECT_CUSTOM_URL_REQUIRED");
    }

    await saveMobileConnectSettings(next);
    await writeAudit("mobile_connect_settings_updated", {
      userId: auth.id,
      detail: {
        mode: next.mode,
        lanHost: next.lanHost || null,
        apiPort: next.apiPort,
        customBaseUrl: next.customBaseUrl ? "[set]" : "",
        token: next.token ? "[set]" : ""
      }
    });

    return res.json({
      ok: true,
      settings: next,
      baseUrlPreview: resolveMobileBaseUrl(next)
    });
  } catch {
    return sendError(res, 500, "Falha ao salvar configuração mobile.", "MOBILE_CONNECT_SAVE_ERROR");
  }
});

app.get("/api/admin/dashboard", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();

    const [
      activeTenantsResult,
      activeSubscriptionsResult,
      expiringLicensesResult,
      botsOnlineResult,
      recentTenantsResult,
      recentAuditResult,
      licensesExpiringSoonResult,
      billingPendingResult,
      suspendedSubsResult,
      expiredLicensesResult
    ] = await Promise.all([
      p.query("SELECT COUNT(1)::int AS count FROM tenants WHERE status='active'"),
      p.query("SELECT COUNT(1)::int AS count FROM subscriptions WHERE status IN ('active','grace_period')"),
      p.query("SELECT COUNT(1)::int AS count FROM licenses WHERE expires_at IS NOT NULL AND expires_at <= NOW() + INTERVAL '15 day'"),
      p.query("SELECT COUNT(1)::int AS count FROM bot_status WHERE is_online=TRUE"),
      p.query("SELECT id, name, plan, status, created_at FROM tenants ORDER BY created_at DESC LIMIT 8"),
      p.query("SELECT id, ts, user_id, tenant_id, action, detail_json FROM audit_log ORDER BY ts DESC LIMIT 15"),
      p.query(
        `
        SELECT l.id, l.tenant_id, t.name AS tenant_name, l.plan, l.billing_cycle, l.status, l.expires_at
        FROM licenses l
        JOIN tenants t ON t.id = l.tenant_id
        WHERE l.expires_at IS NOT NULL
          AND l.expires_at <= NOW() + INTERVAL '30 day'
        ORDER BY l.expires_at ASC
        LIMIT 10
        `
      ),
      p.query(
        `
        SELECT b.id, b.tenant_id, t.name AS tenant_name, b.status, b.amount_cents, b.currency, b.reason, b.created_at
        FROM billing_events b
        LEFT JOIN tenants t ON t.id = b.tenant_id
        WHERE b.status IN ('failed','pending')
        ORDER BY b.created_at DESC
        LIMIT 10
        `
      ),
      p.query("SELECT COUNT(1)::int AS count FROM subscriptions WHERE status IN ('suspended','cancelled')"),
      p.query("SELECT COUNT(1)::int AS count FROM licenses WHERE status='expired'")
    ]);

    const criticalAlerts =
      Number(suspendedSubsResult.rows?.[0]?.count || 0) +
      Number(expiredLicensesResult.rows?.[0]?.count || 0) +
      Number(billingPendingResult.rowCount || 0);

    return res.json({
      ok: true,
      kpis: {
        activeTenants: Number(activeTenantsResult.rows?.[0]?.count || 0),
        activeSubscriptions: Number(activeSubscriptionsResult.rows?.[0]?.count || 0),
        expiringLicenses: Number(expiringLicensesResult.rows?.[0]?.count || 0),
        botsOnline: Number(botsOnlineResult.rows?.[0]?.count || 0),
        criticalAlerts
      },
      recentTenants: recentTenantsResult.rows,
      recentAudit: recentAuditResult.rows,
      licensesExpiringSoon: licensesExpiringSoonResult.rows,
      billingPending: billingPendingResult.rows
    });
  } catch {
    return sendError(res, 500, "Falha ao carregar dashboard.", "DASHBOARD_ERROR");
  }
});

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => createContext({ req, res })
  })
);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // eslint-disable-next-line no-console
  console.error("[cloud-api] unhandled error", err);
  if (res.headersSent) return;
  sendError(res, 500, "Erro interno do servidor. Tente novamente em instantes.", "INTERNAL_ERROR");
});

app.listen(env.PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`HSP Cloud API em http://0.0.0.0:${env.PORT}`);
});

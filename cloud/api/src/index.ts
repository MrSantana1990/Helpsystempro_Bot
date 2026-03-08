import express from "express";
import cors from "cors";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { getEnv } from "./env.js";
import { dbInit } from "./db.js";
import { appRouter } from "./routers.js";
import { createContext } from "./context.js";
import { pool } from "./db.js";
import { id } from "./ids.js";
import { hashPassword, verifyPassword } from "./auth/password.js";
import { signJwt, verifyJwt, type JwtPayload } from "./auth/jwt.js";
import { encryptText, decryptText } from "./crypto.js";
import { generateTotpSecret, totpOtpAuthUrl, totpVerify } from "./auth/totp.js";
import QRCode from "qrcode";

const env = getEnv();

await dbInit();

const app = express();

app.use(
  cors({
    origin: true,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

function bearerToken(req: express.Request): string | null {
  const auth = String(req.headers.authorization || "");
  if (auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim() || null;
  return null;
}

function requireAuth(req: express.Request, res: express.Response): JwtPayload & { id: string } {
  const tok = bearerToken(req);
  if (!tok) {
    res.status(401).json({ error: "Não autenticado." });
    throw new Error("unauthorized");
  }
  try {
    const p = verifyJwt(tok);
    return { ...p, id: p.sub };
  } catch {
    res.status(401).json({ error: "Token inválido." });
    throw new Error("unauthorized");
  }
}

function requireAdmin(req: express.Request, res: express.Response) {
  const u = requireAuth(req, res);
  if (u.role !== "admin") {
    res.status(403).json({ error: "Apenas admin." });
    throw new Error("forbidden");
  }
  return u;
}

function normEmail(v: unknown): string {
  return String(v || "").trim().toLowerCase();
}

function masterEmail(): string {
  return normEmail(process.env.HSP_MASTER_EMAIL || "");
}

function maskEmail(email: string): string {
  const e = normEmail(email);
  const at = e.indexOf("@");
  if (at <= 1) return e;
  return `${e.slice(0, 2)}***${e.slice(at)}`;
}

async function requireMasterAdmin(req: express.Request, res: express.Response) {
  const u = requireAdmin(req, res);
  const master = masterEmail();
  if (!master) return u;
  const p = pool();
  const r = await p.query("SELECT email FROM users WHERE id=$1 LIMIT 1", [u.id]);
  const email = normEmail(r.rows?.[0]?.email);
  if (!email || email !== master) {
    res.status(403).json({ error: "Apenas master pode gerenciar este painel." });
    throw new Error("forbidden-master");
  }
  return u;
}

app.get("/api/public/config", (_req, res) => {
  const m = masterEmail();
  return res.json({
    ok: true,
    masterMode: !!m,
    masterEmailHint: m ? maskEmail(m) : "",
    masterEmail: m || ""
  });
});

// REST (MVP) — facilita admin/mobile sem client tRPC.
app.post("/api/bootstrap-admin", async (req, res) => {
  try {
    const { bootstrapCode, email, password } = req.body || {};
    if (String(bootstrapCode || "") !== env.HSP_BOOTSTRAP_CODE) return res.status(403).json({ error: "Código inválido." });
    if (!String(email || "").includes("@") || String(password || "").length < 8) return res.status(400).json({ error: "Dados inválidos." });
    const m = masterEmail();
    if (m && normEmail(email) !== m) return res.status(403).json({ error: "Email diferente do master configurado no servidor." });
    const p = pool();
    const any = await p.query("SELECT 1 FROM users LIMIT 1");
    if (any.rowCount && any.rowCount > 0) return res.status(403).json({ error: "Bootstrap já concluído." });
    const userId = id("usr");
    const pw = await hashPassword(String(password));
    await p.query("INSERT INTO users (id,email,password_hash,role,totp_enabled) VALUES ($1,$2,$3,'admin',FALSE)", [
      userId,
      String(email).toLowerCase(),
      pw
    ]);
    return res.json({ ok: true, userId });
  } catch (e: any) {
    return res.status(500).json({ error: "Falha no bootstrap." });
  }
});

app.post("/api/totp/setup-start", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const p = pool();
    const r = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [String(email || "").toLowerCase()]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: "Credenciais inválidas." });
    const ok = await verifyPassword(String(password || ""), String(u.password_hash));
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });
    if (u.totp_enabled) return res.status(409).json({ error: "2FA já está ativo." });
    const { secret } = generateTotpSecret();
    const otpauth = totpOtpAuthUrl({ issuer: "HelpSystem Pro", label: String(u.email || u.id), secret });
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, scale: 6 });
    await p.query("UPDATE users SET totp_secret_enc=$1 WHERE id=$2", [encryptText(secret), String(u.id)]);
    return res.json({ ok: true, otpauth, qrDataUrl });
  } catch {
    return res.status(500).json({ error: "Falha no setup 2FA." });
  }
});

app.post("/api/totp/enable", async (req, res) => {
  try {
    const { email, password, code } = req.body || {};
    const p = pool();
    const r = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [String(email || "").toLowerCase()]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: "Credenciais inválidas." });
    const ok = await verifyPassword(String(password || ""), String(u.password_hash));
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });
    if (u.totp_enabled) return res.json({ ok: true });
    if (!u.totp_secret_enc) return res.status(428).json({ error: "Faça o setup primeiro." });
    const secret = decryptText(String(u.totp_secret_enc));
    if (!totpVerify(secret, String(code || ""))) return res.status(401).json({ error: "Código inválido." });
    await p.query("UPDATE users SET totp_enabled=TRUE WHERE id=$1", [String(u.id)]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Falha ao habilitar 2FA." });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password, totp } = req.body || {};
    const p = pool();
    const r = await p.query("SELECT * FROM users WHERE email=$1 LIMIT 1", [String(email || "").toLowerCase()]);
    const u = r.rows[0];
    if (!u) return res.status(401).json({ error: "Credenciais inválidas." });
    const ok = await verifyPassword(String(password || ""), String(u.password_hash));
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });
    if (!u.totp_enabled) return res.status(428).json({ error: "2FA obrigatório. Faça o setup." });
    if (!u.totp_secret_enc) return res.status(428).json({ error: "2FA inconsistente. Refaça o setup." });
    const m = masterEmail();
    if (m && String(u.role || "") === "admin" && normEmail(u.email) !== m) {
      return res.status(403).json({ error: "Conta admin reservada ao master." });
    }
    const secret = decryptText(String(u.totp_secret_enc));
    if (!totpVerify(secret, String(totp || ""))) return res.status(401).json({ error: "TOTP inválido." });
    const tenantIdsR = await p.query("SELECT tenant_id FROM user_tenants WHERE user_id=$1", [String(u.id)]);
    const tenantIds = tenantIdsR.rows.map((x: any) => String(x.tenant_id));
    const token = signJwt({ sub: String(u.id), role: u.role === "admin" ? "admin" : "user", tenantIds });
    return res.json({ ok: true, token, role: u.role, tenantIds });
  } catch {
    return res.status(500).json({ error: "Falha no login." });
  }
});

app.get("/api/me", async (req, res) => {
  try {
    const u = requireAuth(req, res);
    const p = pool();
    const r = await p.query("SELECT id,email,role,totp_enabled,created_at FROM users WHERE id=$1", [u.id]);
    return res.json({ ok: true, user: r.rows[0], tenantIds: u.tenantIds });
  } catch {
    return;
  }
});

app.get("/api/admin/users", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const r = await p.query("SELECT id,email,role,totp_enabled,created_at FROM users ORDER BY created_at DESC LIMIT 500");
    return res.json({ ok: true, rows: r.rows });
  } catch {
    return;
  }
});

app.post("/api/admin/users", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const { email, password, role } = req.body || {};
    if (!String(email || "").includes("@") || String(password || "").length < 8) return res.status(400).json({ error: "Dados inválidos." });
    const m = masterEmail();
    const roleWanted = String(role || "user") === "admin" ? "admin" : "user";
    if (m && roleWanted === "admin") return res.status(403).json({ error: "Apenas o master pode ser admin." });
    const p = pool();
    const userId = id("usr");
    const pw = await hashPassword(String(password));
    await p.query("INSERT INTO users (id,email,password_hash,role,totp_enabled) VALUES ($1,$2,$3,$4,FALSE)", [
      userId,
      String(email).toLowerCase(),
      pw,
      roleWanted
    ]);
    return res.json({ ok: true, userId });
  } catch {
    return res.status(500).json({ error: "Falha ao criar usuário." });
  }
});

app.get("/api/admin/tenants", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const r = await p.query("SELECT id,name,plan,status,created_at FROM tenants ORDER BY created_at DESC LIMIT 500");
    return res.json({ ok: true, rows: r.rows });
  } catch {
    return;
  }
});

app.post("/api/admin/tenants", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const { name, plan } = req.body || {};
    if (String(name || "").trim().length < 2) return res.status(400).json({ error: "Nome inválido." });
    const p = pool();
    const tenantId = id("tnt");
    await p.query("INSERT INTO tenants (id,name,plan,status) VALUES ($1,$2,$3,'active')", [tenantId, String(name), String(plan || "starter")]);
    return res.json({ ok: true, tenantId });
  } catch {
    return res.status(500).json({ error: "Falha ao criar tenant." });
  }
});

app.get("/api/admin/links", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const p = pool();
    const r = await p.query(
      `SELECT ut.user_id, ut.tenant_id, u.email AS user_email, t.name AS tenant_name, t.plan AS tenant_plan
       FROM user_tenants ut
       JOIN users u ON u.id = ut.user_id
       JOIN tenants t ON t.id = ut.tenant_id
       ORDER BY u.email ASC, t.name ASC
       LIMIT 1000`
    );
    return res.json({ ok: true, rows: r.rows });
  } catch {
    return;
  }
});

app.post("/api/admin/grant", async (req, res) => {
  try {
    await requireMasterAdmin(req, res);
    const { userId, tenantId } = req.body || {};
    if (!String(userId || "") || !String(tenantId || "")) return res.status(400).json({ error: "Dados inválidos." });
    const p = pool();
    await p.query("INSERT INTO user_tenants (user_id, tenant_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [String(userId), String(tenantId)]);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Falha no grant." });
  }
});

app.use(
  "/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: ({ req, res }) => createContext({ req, res })
  })
);

app.listen(env.PORT, "0.0.0.0", () => {
  // eslint-disable-next-line no-console
  console.log(`HSP Cloud API em http://0.0.0.0:${env.PORT}`);
});

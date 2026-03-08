import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
  useSearchParams
} from "react-router-dom";
import QRCode from "qrcode";
import { ApiError, apiJson } from "./lib/api";

type User = {
  id: string;
  email: string;
  role: "admin" | "user";
  totp_enabled: boolean;
  created_at: string;
};

type Tenant = {
  id: string;
  name: string;
  plan: string;
  status: string;
  created_at: string;
};

type LicenseRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  plan: string;
  billing_cycle?: string;
  status: string;
  expires_at: string | null;
  machine_hash: string | null;
  created_at: string;
};

type BillingRow = {
  id: string;
  tenant_id: string | null;
  tenant_name: string | null;
  status: string;
  amount_cents: number;
  currency: string;
  reason: string;
  created_at: string;
};

type InvoiceRow = {
  id: string;
  tenant_id: string;
  tenant_name: string;
  subscription_id: string | null;
  provider: string;
  status: "pending" | "paid" | "overdue" | "cancelled" | "suspended" | "failed";
  amount_cents: number;
  currency: string;
  due_at: string | null;
  paid_at: string | null;
  external_id: string | null;
  external_payload: string;
  plan?: string;
  billing_cycle?: string;
  created_at: string;
  updated_at: string;
};

type WebhookRow = {
  id: string;
  provider: string;
  event_id: string;
  status: string;
  processed_at: string | null;
  created_at: string;
};

type SubscriberRow = {
  user_id: string;
  email: string;
  role: string;
  totp_enabled: boolean;
  tenant_id: string;
  tenant_name: string;
  tenant_plan: string;
  tenant_status: string;
  subscription_status: string | null;
  subscription_billing_cycle?: string | null;
  subscription_expires_at: string | null;
};

type RegistrationRequestRow = {
  id: string;
  full_name: string;
  email: string;
  requested_plan: string;
  requested_cycle: string;
  objective: string;
  status: "pending" | "approved" | "rejected";
  payment_status: "pending" | "paid" | "failed";
  payment_method: string;
  payment_reference: string;
  notes: string;
  approved_tenant_id?: string | null;
  approved_user_id?: string | null;
  approved_by_user_id?: string | null;
  approved_at?: string | null;
  created_at: string;
  updated_at: string;
};

type LinkRow = {
  user_id: string;
  tenant_id: string;
  user_email: string;
  tenant_name: string;
  tenant_plan: string;
};

type AuditRow = {
  id: string;
  ts: string;
  user_id: string | null;
  tenant_id: string | null;
  action: string;
  detail_json: string;
};

type DashboardResponse = {
  ok: true;
  kpis: {
    activeTenants: number;
    activeSubscriptions: number;
    expiringLicenses: number;
    botsOnline: number;
    criticalAlerts: number;
  };
  recentTenants: Tenant[];
  recentAudit: AuditRow[];
  licensesExpiringSoon: Array<{
    id: string;
    tenant_id: string;
    tenant_name: string;
    plan: string;
    status: string;
    expires_at: string | null;
  }>;
  billingPending: BillingRow[];
};

type PublicConfig = {
  ok: true;
  masterMode: boolean;
  masterEmailHint: string;
};

type BootstrapStatus = {
  ok: true;
  usersCount: number;
  requiresBootstrap: boolean;
  bootstrapLocked: boolean;
  masterMode: boolean;
  masterEmailHint: string;
};

type SecurityPayload = {
  ok: true;
  stats: {
    totalUsers: number;
    usersWith2FA: number;
    twoFactorCoveragePct: number;
    masterMode: boolean;
    masterEmailHint: string;
  };
  admins: Array<{ id: string; email: string; created_at: string }>;
};

type MobileConnectSettings = {
  mode: "local" | "lan" | "custom";
  lanHost: string;
  apiPort: number;
  customBaseUrl: string;
  token: string;
};

type SettingsPayload = {
  ok: true;
  settings: {
    environment: string;
    baseUrl: string;
    apiPort: number;
    masterMode: boolean;
    masterEmailHint: string;
    operatorEmail: string;
    mobileConnect?: MobileConnectSettings;
  };
  mobileConnect?: MobileConnectSettings & { baseUrlPreview: string };
};

type Session = {
  token: string;
  user: User | null;
  tenantIds: string[];
  setToken: (token: string) => void;
  refreshMe: () => Promise<void>;
  logout: () => void;
};

type ConsoleContext = {
  query: string;
  setQuery: (value: string) => void;
  token: string;
  user: User;
  logout: () => void;
};

const NAV_ITEMS = [
  { to: "/console", label: "Painel", end: true },
  { to: "/console/subscribers", label: "Assinantes" },
  { to: "/console/requests", label: "Solicitacoes" },
  { to: "/console/tenants", label: "Clientes" },
  { to: "/console/licenses", label: "Licencas" },
  { to: "/console/billing", label: "Cobranca" },
  { to: "/console/users", label: "Usuarios" },
  { to: "/console/security", label: "Seguranca" },
  { to: "/console/audit", label: "Auditoria" },
  { to: "/console/settings", label: "Configuracoes" }
];

const PLAN_OPTIONS = [
  { value: "starter", label: "Starter" },
  { value: "pro", label: "Pro" },
  { value: "premium", label: "Premium" }
];

const BILLING_CYCLE_OPTIONS = [
  { value: "monthly", label: "Mensal" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" }
];

const LICENSE_STATUS_OPTIONS = [
  { value: "active", label: "Ativa" },
  { value: "expired", label: "Expirada" },
  { value: "suspended", label: "Suspensa" }
];

const BILLING_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "failed", label: "Falhou" },
  { value: "paid", label: "Pago" }
];

const INVOICE_STATUS_OPTIONS = [
  { value: "pending", label: "Pendente" },
  { value: "paid", label: "Pago" },
  { value: "overdue", label: "Vencido" },
  { value: "cancelled", label: "Cancelado" },
  { value: "suspended", label: "Suspenso" },
  { value: "failed", label: "Falhou" }
];

const REQUEST_PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "Pagamento pendente" },
  { value: "paid", label: "Pagamento confirmado" },
  { value: "failed", label: "Pagamento falhou" }
];

const PLAN_PERKS: Record<string, string[]> = {
  starter: ["Painel operacional", "Monitoramento básico", "Suporte padrão"],
  pro: ["Tudo do Starter", "Alertas avançados", "Relatórios e auditoria"],
  premium: ["Tudo do Pro", "Acompanhamento prioritário", "Tuning dedicado"]
};

const STATUS_LABELS: Record<string, string> = {
  active: "Ativo",
  inactive: "Inativo",
  suspended: "Suspenso",
  cancelled: "Cancelado",
  grace_period: "Graca",
  expired: "Expirado",
  overdue: "Vencido",
  pending: "Pendente",
  failed: "Falhou",
  paid: "Pago"
};

function labelFromOptions(value: string, options: Array<{ value: string; label: string }>) {
  const item = options.find((entry) => entry.value === value);
  return item?.label || value || "-";
}

function statusLabel(value: string) {
  return STATUS_LABELS[String(value || "").toLowerCase()] || value || "-";
}

function environmentLabel(value: string) {
  const parsed = String(value || "").toLowerCase();
  if (!parsed) return "-";
  if (parsed === "production") return "producao";
  if (parsed === "development") return "desenvolvimento";
  if (parsed === "staging") return "homologacao";
  return parsed;
}

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("hsp_cloud_token") || "");
  const [user, setUser] = useState<User | null>(null);
  const [tenantIds, setTenantIds] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem("hsp_cloud_token", token || "");
  }, [token]);

  const refreshMe = async () => {
    if (!token) {
      setUser(null);
      setTenantIds([]);
      return;
    }
    const me = await apiJson<{ ok: true; user: User; tenantIds: string[] }>("/api/me", { token });
    setUser(me.user || null);
    setTenantIds(me.tenantIds || []);
  };

  useEffect(() => {
    if (!token) {
      setUser(null);
      setTenantIds([]);
      return;
    }
    refreshMe().catch(() => {
      setToken("");
      setUser(null);
      setTenantIds([]);
    });
  }, [token]);

  const logout = () => {
    setToken("");
    setUser(null);
    setTenantIds([]);
    localStorage.removeItem("hsp_cloud_token");
  };

  const session = useMemo<Session>(
    () => ({
      token,
      user,
      tenantIds,
      setToken,
      refreshMe,
      logout
    }),
    [token, user, tenantIds]
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={session.token ? "/console" : "/login"} replace />} />
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route path="/onboarding/bootstrap" element={<BootstrapPage />} />
        <Route path="/onboarding/2fa" element={<TwoFaOnboardingPage />} />
        <Route element={<ProtectedRoute session={session} />}>
          <Route path="/console" element={<ConsoleLayout session={session} />}>
            <Route index element={<DashboardPage />} />
            <Route path="subscribers" element={<SubscribersPage />} />
            <Route path="requests" element={<RegistrationRequestsPage />} />
            <Route path="tenants" element={<TenantsPage />} />
            <Route path="licenses" element={<LicensesPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function ProtectedRoute({ session }: { session: Session }) {
  if (!session.token) return <Navigate to="/login" replace />;
  if (!session.user) {
    return (
      <div className="min-h-screen bg-bg text-text">
        <div className="mx-auto max-w-xl p-6">
          <Card className="p-6">
            <Skeleton rows={3} />
          </Card>
        </div>
      </div>
    );
  }
  return <Outlet />;
}

function LoginPage({ session }: { session: Session }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session.token && session.user) navigate("/console", { replace: true });
  }, [session.token, session.user, navigate]);

  useEffect(() => {
    apiJson<PublicConfig>("/api/public/config")
      .then(setPublicConfig)
      .catch(() => setPublicConfig(null));
  }, []);

  const submit = async () => {
    setError("");
    if (!String(email).trim().includes("@")) {
      setError("Informe um email valido.");
      return;
    }
    if (!String(password).trim()) {
      setError("Informe sua senha.");
      return;
    }
    if (!String(totp).trim() || String(totp).trim().length < 6) {
      setError("Informe o codigo TOTP de 6 digitos.");
      return;
    }
    setLoading(true);
    try {
      const response = await apiJson<{ ok: true; token: string }>("/api/login", {
        method: "POST",
        body: { email, password, totp }
      });
      session.setToken(response.token);
      await session.refreshMe();
      navigate("/console", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.code === "TOTP_REQUIRED" || err.code === "TOTP_SETUP_REQUIRED")) {
        navigate(`/onboarding/2fa?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(err instanceof Error ? err.message : "Falha no login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto grid min-h-screen max-w-[1320px] grid-cols-1 gap-6 p-4 lg:grid-cols-[1.1fr_1fr] lg:p-8">
        <section className="rounded-3xl border border-border bg-panel p-8 shadow-soft">
          <span className="inline-flex rounded-full border border-accent/35 bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
            HelpSystem Pro | Controle Administrativo
          </span>
          <h1 className="mt-6 text-4xl font-black tracking-tight">Governanca central em VPS privada</h1>
          <p className="mt-3 max-w-xl text-sm text-dim">
            Console master para operacao, licencas, seguranca e auditoria. Fluxos de onboarding separados e 2FA obrigatorio.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FeatureBadge label="2FA obrigatorio no admin" />
            <FeatureBadge label="Auditoria de acoes" />
            <FeatureBadge label="Licencas e cobranca operacionais" />
            <FeatureBadge label="Rotas segregadas por fluxo" />
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-black/25 p-4 text-xs text-dim">
            <div>Modo master: {publicConfig?.masterMode ? "ATIVO" : "INATIVO"}</div>
            <div>Email master: {publicConfig?.masterEmailHint || "-"}</div>
            <div className="mt-2">
              Bootstrap interno:{" "}
              <Link className="text-accent underline-offset-2 hover:underline" to="/onboarding/bootstrap">
                /onboarding/bootstrap
              </Link>
            </div>
          </div>
        </section>

        <section className="flex items-center">
          <Card className="w-full p-6 lg:p-8">
            <h2 className="text-2xl font-extrabold">Acesso seguro</h2>
            <p className="mt-1 text-sm text-dim">Login separado do onboarding. O bootstrap nunca aparece nesta tela.</p>
            <div className="mt-6 grid gap-3">
              <Input label="Email" value={email} onChange={setEmail} placeholder="master@dominio.com" />
              <Input label="Senha" type="password" value={password} onChange={setPassword} placeholder="Sua senha" />
              <Input label="Codigo TOTP" value={totp} onChange={setTotp} placeholder="6 digitos" />
              {error ? <Alert kind="error">{error}</Alert> : null}
              <Button onClick={submit} disabled={loading}>
                {loading ? "Entrando..." : "Entrar no painel"}
              </Button>
            </div>
            <div className="mt-4 text-xs text-mute">
              Sem 2FA ativo, o fluxo redireciona para <span className="font-mono">/onboarding/2fa</span>.
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}

function BootstrapPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<BootstrapStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [bootstrapCode, setBootstrapCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const payload = await apiJson<BootstrapStatus>("/api/public/bootstrap-status");
      setStatus(payload);
    } catch {
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadStatus().catch(() => undefined);
  }, []);

  const submit = async () => {
    setMessage("");
    if (!String(bootstrapCode).trim()) {
      setMessage("Informe o codigo de bootstrap.");
      return;
    }
    if (!String(email).trim().includes("@")) {
      setMessage("Informe um email master valido.");
      return;
    }
    if (String(password).trim().length < 8) {
      setMessage("A senha inicial deve ter no minimo 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      await apiJson("/api/bootstrap-admin", {
        method: "POST",
        body: { bootstrapCode, email, password }
      });
      setMessage("Master criado com sucesso. Proximo passo: ativar 2FA.");
      navigate(`/onboarding/2fa?email=${encodeURIComponent(email)}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha no bootstrap.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Onboarding interno — Bootstrap"
      subtitle="Fluxo restrito para criar o primeiro admin. Este passo e bloqueado apos concluir."
      rightLink={
        <Link className="text-xs text-accent underline-offset-2 hover:underline" to="/login">
          Voltar ao login
        </Link>
      }
    >
      {loadingStatus ? <Skeleton rows={3} /> : null}
      {!loadingStatus && status?.bootstrapLocked ? (
        <Alert kind="info">
          Bootstrap já concluído. Usuários existentes: {status.usersCount}. Master: {status.masterEmailHint || "-"}.
          Continue em{" "}
          <Link className="underline" to="/login">
            /login
          </Link>
          {" "}ou finalize 2FA em{" "}
          <Link className="underline" to="/onboarding/2fa">
            /onboarding/2fa
          </Link>
          .
        </Alert>
      ) : null}
      {!loadingStatus && status?.requiresBootstrap ? (
        <div className="grid gap-3">
          <Input label="Codigo de bootstrap" value={bootstrapCode} onChange={setBootstrapCode} placeholder="HSP_BOOTSTRAP_CODE" />
          <Input label="Email master" value={email} onChange={setEmail} placeholder="master@dominio.com" />
          <Input label="Senha inicial" type="password" value={password} onChange={setPassword} placeholder="Minimo 8 caracteres" />
          {message ? <Alert kind={message.startsWith("Master criado") ? "success" : "error"}>{message}</Alert> : null}
          <Button onClick={submit} disabled={loading}>
            {loading ? "Criando..." : "Criar admin master"}
          </Button>
        </div>
      ) : null}
    </AuthShell>
  );
}

function TwoFaOnboardingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const startSetup = async () => {
    if (!String(email).trim().includes("@")) {
      setMessage("Informe um email valido.");
      return;
    }
    if (!String(password).trim()) {
      setMessage("Informe a senha da conta.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await apiJson<{ ok: true; qrDataUrl: string }>("/api/totp/setup-start", {
        method: "POST",
        body: { email, password }
      });
      setQrDataUrl(response.qrDataUrl);
      setStep(2);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao gerar QR.");
    } finally {
      setLoading(false);
    }
  };

  const enable2fa = async () => {
    if (!String(code).trim() || String(code).trim().length < 6) {
      setMessage("Informe o codigo de 6 digitos do autenticador.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      await apiJson("/api/totp/enable", {
        method: "POST",
        body: { email, password, code }
      });
      setStep(3);
      setMessage("2FA ativado com sucesso. Voce pode entrar no login.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Falha ao ativar 2FA.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Onboarding de seguranca (2FA)"
      subtitle="Fluxo em etapas para ativar Google Authenticator antes do primeiro login."
      rightLink={
        <Link className="text-xs text-accent underline-offset-2 hover:underline" to="/login">
          Voltar ao login
        </Link>
      }
    >
      <Stepper
        steps={[
          { title: "Credenciais", active: step === 1, done: step > 1 },
          { title: "QR do autenticador", active: step === 2, done: step > 2 },
          { title: "Finalizar", active: step === 3, done: step === 3 }
        ]}
      />

      {step === 1 ? (
        <div className="mt-4 grid gap-3">
          <Input label="Email" value={email} onChange={setEmail} placeholder="master@dominio.com" />
          <Input label="Senha" type="password" value={password} onChange={setPassword} placeholder="Senha da conta" />
          {message ? <Alert kind="error">{message}</Alert> : null}
          <Button onClick={startSetup} disabled={loading}>
            {loading ? "Gerando..." : "Gerar QR do 2FA"}
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="mt-4 grid gap-3">
          <div className="rounded-2xl border border-border bg-black/30 p-4">
            <div className="text-sm font-semibold">Escaneie o QR no Google Authenticator</div>
            {qrDataUrl ? <img src={qrDataUrl} alt="QR code para 2FA" className="mt-3 max-w-[220px] rounded-xl border border-border" /> : null}
          </div>
          <Input label="Codigo de confirmacao" value={code} onChange={setCode} placeholder="6 digitos" />
          {message ? <Alert kind="error">{message}</Alert> : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)} disabled={loading}>
              Voltar
            </Button>
            <Button onClick={enable2fa} disabled={loading}>
              {loading ? "Ativando..." : "Ativar 2FA"}
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="mt-4 grid gap-3">
          <Alert kind="success">{message || "2FA pronto."}</Alert>
          <Button onClick={() => navigate(`/login?email=${encodeURIComponent(email)}`)}>Ir para login</Button>
        </div>
      ) : null}
    </AuthShell>
  );
}

function ConsoleLayout({ session }: { session: Session }) {
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [kpis, setKpis] = useState<DashboardResponse["kpis"] | null>(null);
  const [settings, setSettings] = useState<SettingsPayload["settings"] | null>(null);

  const activeNav = NAV_ITEMS.find((item) => location.pathname === item.to || (!item.end && location.pathname.startsWith(item.to)));

  const refreshTopMetrics = async () => {
    try {
      const [dashboard, appSettings] = await Promise.all([
        apiJson<DashboardResponse>("/api/admin/dashboard", { token: session.token }),
        apiJson<SettingsPayload>("/api/admin/settings", { token: session.token })
      ]);
      setKpis(dashboard.kpis);
      setSettings(appSettings.settings);
    } catch {
      setKpis(null);
      setSettings(null);
    }
  };

  useEffect(() => {
    refreshTopMetrics().catch(() => undefined);
  }, [session.token]);

  const outletContext: ConsoleContext = {
    query,
    setQuery,
    token: session.token,
    user: session.user!,
    logout: session.logout
  };

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-4 p-4 lg:p-6">
        <aside className="hidden w-[270px] shrink-0 rounded-3xl border border-border bg-panel p-4 shadow-soft lg:block">
          <div className="rounded-2xl border border-border bg-black/25 p-4">
            <div className="text-lg font-black">HelpSystem Pro</div>
            <div className="text-xs text-dim">Console Administrativo</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge>{environmentLabel(settings?.environment || "vps")}</Badge>
              <Badge>{session.user?.role || "admin"}</Badge>
            </div>
          </div>
          <nav className="mt-4 grid gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "border-accent/45 bg-accent text-black"
                      : "border-border bg-black/20 text-dim hover:border-white/25 hover:text-text"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1">
          <Card className="rounded-3xl p-4 shadow-soft">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                label=""
                value={query}
                onChange={setQuery}
                placeholder="Pesquisa global (cliente, usuario, acao, id)"
                className="min-w-[250px] flex-1"
              />
              <Badge>{activeNav?.label || "Painel"}</Badge>
              <Badge tone={(kpis?.criticalAlerts || 0) > 0 ? "danger" : "success"}>
                alertas: {kpis?.criticalAlerts ?? "-"}
              </Badge>
              <Badge>{environmentLabel(settings?.environment || "vps")}</Badge>
              <Badge>{session.user?.email || "-"}</Badge>
              <Button variant="secondary" onClick={() => refreshTopMetrics().catch(() => undefined)}>
                Atualizar
              </Button>
              <Button variant="danger" onClick={session.logout}>
                Sair
              </Button>
            </div>
          </Card>

          <div className="mt-4 lg:hidden">
            <Card className="p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `rounded-xl border px-3 py-2 text-center text-xs font-semibold transition ${
                        isActive ? "border-accent/45 bg-accent text-black" : "border-border bg-black/20 text-dim"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-4">
            <Outlet context={outletContext} />
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { token, query } = useConsoleContext();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson<DashboardResponse>("/api/admin/dashboard", { token });
      setData(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar dashboard.");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const q = query.trim().toLowerCase();
  const filteredTenants = (data?.recentTenants || []).filter((row) => `${row.name} ${row.plan} ${row.status}`.toLowerCase().includes(q));
  const filteredAudit = (data?.recentAudit || []).filter((row) =>
    `${row.action} ${row.user_id || ""} ${row.tenant_id || ""}`.toLowerCase().includes(q)
  );
  const filteredLicenses = (data?.licensesExpiringSoon || []).filter((row) =>
    `${row.tenant_name} ${row.plan} ${row.status}`.toLowerCase().includes(q)
  );
  const filteredBilling = (data?.billingPending || []).filter((row) =>
    `${row.tenant_name || ""} ${row.status} ${row.reason}`.toLowerCase().includes(q)
  );

  return (
    <div className="grid gap-4">
      {error ? <Alert kind="error">{error}</Alert> : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard label="Clientes ativos" value={loading ? "-" : String(data?.kpis.activeTenants ?? 0)} />
        <KpiCard label="Assinaturas ativas" value={loading ? "-" : String(data?.kpis.activeSubscriptions ?? 0)} />
        <KpiCard label="Licencas vencendo" value={loading ? "-" : String(data?.kpis.expiringLicenses ?? 0)} />
        <KpiCard label="Bots online" value={loading ? "-" : String(data?.kpis.botsOnline ?? 0)} />
        <KpiCard label="Alertas criticos" value={loading ? "-" : String(data?.kpis.criticalAlerts ?? 0)} tone={(data?.kpis.criticalAlerts || 0) > 0 ? "danger" : "default"} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Clientes recentes" action={<Button variant="secondary" onClick={() => load().catch(() => undefined)}>Atualizar</Button>}>
          {loading ? <Skeleton rows={6} /> : <DataTable emptyMessage="Sem clientes recentes." headers={["Nome", "Plano", "Status", "Criado"]} rows={filteredTenants.map((row) => [row.name, labelFromOptions(row.plan, PLAN_OPTIONS), statusLabel(row.status), formatDate(row.created_at)])} />}
        </Card>
        <Card title="Licencas proximas do vencimento">
          {loading ? <Skeleton rows={6} /> : <DataTable emptyMessage="Sem licencas proximas do vencimento." headers={["Cliente", "Plano", "Status", "Expira em"]} rows={filteredLicenses.map((row) => [row.tenant_name, labelFromOptions(row.plan, PLAN_OPTIONS), statusLabel(row.status), formatDate(row.expires_at)])} />}
        </Card>
        <Card title="Eventos recentes de auditoria">
          {loading ? <Skeleton rows={7} /> : <DataTable emptyMessage="Sem eventos de auditoria." headers={["Acao", "Usuario", "Cliente", "Data"]} rows={filteredAudit.map((row) => [row.action, row.user_id || "-", row.tenant_id || "-", formatDate(row.ts)])} />}
        </Card>
        <Card title="Cobranca com falha / acoes pendentes">
          {loading ? <Skeleton rows={7} /> : <DataTable emptyMessage="Sem pendencias de cobranca." headers={["Cliente", "Status", "Motivo", "Valor"]} rows={filteredBilling.map((row) => [row.tenant_name || "-", labelFromOptions(row.status, BILLING_STATUS_OPTIONS), row.reason || "-", formatCurrency(row.amount_cents, row.currency)])} />}
        </Card>
      </div>
    </div>
  );
}

function SubscribersPage() {
  const { token, query } = useConsoleContext();
  const [rows, setRows] = useState<SubscriberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson<{ ok: true; rows: SubscriberRow[] }>("/api/admin/subscribers", { token });
      setRows(response.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar assinantes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) =>
    `${row.email} ${row.tenant_name} ${row.tenant_plan} ${row.subscription_status || ""}`.toLowerCase().includes(q)
  );

  return (
    <Card title="Assinantes" action={<Button variant="secondary" onClick={() => load().catch(() => undefined)}>Atualizar</Button>}>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {loading ? <Skeleton rows={8} /> : <DataTable emptyMessage="Nenhum assinante encontrado." headers={["Usuario", "Cliente", "Plano", "Ciclo", "Assinatura", "2FA"]} rows={filtered.map((row) => [row.email, row.tenant_name, labelFromOptions(row.tenant_plan, PLAN_OPTIONS), labelFromOptions(String(row.subscription_billing_cycle || "monthly"), BILLING_CYCLE_OPTIONS), row.subscription_status || "-", row.totp_enabled ? "OK" : "Pendente"])} />}
    </Card>
  );
}

function RegistrationRequestsPage() {
  const { token, query } = useConsoleContext();
  const [rows, setRows] = useState<RegistrationRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [drafts, setDrafts] = useState<Record<string, {
    plan: string;
    billingCycle: string;
    paymentStatus: string;
    paymentMethod: string;
    paymentReference: string;
    notes: string;
  }>>({});

  const defaultsFor = (row: RegistrationRequestRow) => ({
    plan: row.requested_plan || "starter",
    billingCycle: row.requested_cycle || "monthly",
    paymentStatus: row.payment_status || "pending",
    paymentMethod: row.payment_method || "",
    paymentReference: row.payment_reference || "",
    notes: row.notes || ""
  });

  const draftFor = (row: RegistrationRequestRow) => ({
    ...defaultsFor(row),
    ...(drafts[row.id] || {})
  });

  const patchDraft = (row: RegistrationRequestRow, patch: Partial<ReturnType<typeof defaultsFor>>) => {
    setDrafts((prev) => ({
      ...prev,
      [row.id]: {
        ...defaultsFor(row),
        ...(prev[row.id] || {}),
        ...patch
      }
    }));
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson<{ ok: true; rows: RegistrationRequestRow[] }>("/api/admin/registration-requests", { token });
      setRows(response.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar solicitações.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const savePayment = async (row: RegistrationRequestRow) => {
    const draft = draftFor(row);
    setBusyId(row.id);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/admin/registration-requests/${row.id}/payment`, {
        token,
        method: "POST",
        body: {
          paymentStatus: draft.paymentStatus,
          paymentMethod: draft.paymentMethod,
          paymentReference: draft.paymentReference,
          notes: draft.notes
        }
      });
      setSuccess(`Pagamento da solicitação ${row.email} atualizado.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar pagamento.");
    } finally {
      setBusyId("");
    }
  };

  const approve = async (row: RegistrationRequestRow) => {
    const draft = draftFor(row);
    setBusyId(row.id);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/admin/registration-requests/${row.id}/payment`, {
        token,
        method: "POST",
        body: {
          paymentStatus: draft.paymentStatus,
          paymentMethod: draft.paymentMethod,
          paymentReference: draft.paymentReference,
          notes: draft.notes
        }
      });
      await apiJson(`/api/admin/registration-requests/${row.id}/approve`, {
        token,
        method: "POST",
        body: {
          plan: draft.plan,
          billingCycle: draft.billingCycle,
          subscriptionStatus: "active",
          licenseStatus: "active",
          notes: draft.notes
        }
      });
      setSuccess(`Solicitação aprovada: ${row.email}. Acesso liberado no portal operacional.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao aprovar solicitação.");
    } finally {
      setBusyId("");
    }
  };

  const reject = async (row: RegistrationRequestRow) => {
    const draft = draftFor(row);
    setBusyId(row.id);
    setError("");
    setSuccess("");
    try {
      await apiJson(`/api/admin/registration-requests/${row.id}/reject`, {
        token,
        method: "POST",
        body: { notes: draft.notes }
      });
      setSuccess(`Solicitação rejeitada: ${row.email}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao rejeitar solicitação.");
    } finally {
      setBusyId("");
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) =>
    `${row.full_name} ${row.email} ${row.requested_plan} ${row.requested_cycle} ${row.status} ${row.payment_status}`.toLowerCase().includes(q)
  );
  const pending = filtered.filter((row) => row.status === "pending");
  const history = filtered.filter((row) => row.status !== "pending");

  return (
    <div className="grid gap-4">
      <Card title="Solicitações de cadastro" action={<Button variant="secondary" onClick={() => load().catch(() => undefined)}>Atualizar</Button>}>
        {error ? <Alert kind="error">{error}</Alert> : null}
        {success ? <Alert kind="success">{success}</Alert> : null}
        {loading ? (
          <Skeleton rows={6} />
        ) : pending.length ? (
          <div className="grid gap-3">
            {pending.map((row) => {
              const draft = draftFor(row);
              const perks = PLAN_PERKS[draft.plan] || PLAN_PERKS.starter;
              return (
                <div key={row.id} className="rounded-xl border border-border bg-black/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{row.full_name}</div>
                      <div className="text-xs text-dim">{row.email}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge>{statusLabel(row.status)}</Badge>
                      <Badge tone={draft.paymentStatus === "paid" ? "success" : draft.paymentStatus === "failed" ? "danger" : "default"}>
                        {labelFromOptions(draft.paymentStatus, REQUEST_PAYMENT_STATUS_OPTIONS)}
                      </Badge>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-3">
                    <SelectField
                      label="Plano"
                      value={draft.plan}
                      onChange={(value) => patchDraft(row, { plan: value })}
                      options={PLAN_OPTIONS}
                    />
                    <SelectField
                      label="Ciclo da licença"
                      value={draft.billingCycle}
                      onChange={(value) => patchDraft(row, { billingCycle: value })}
                      options={BILLING_CYCLE_OPTIONS}
                    />
                    <SelectField
                      label="Pagamento"
                      value={draft.paymentStatus}
                      onChange={(value) => patchDraft(row, { paymentStatus: value })}
                      options={REQUEST_PAYMENT_STATUS_OPTIONS}
                    />
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-3 xl:grid-cols-2">
                    <Input
                      label="Método de pagamento"
                      value={draft.paymentMethod}
                      onChange={(value) => patchDraft(row, { paymentMethod: value })}
                      placeholder="PIX, Cartão, Boleto..."
                    />
                    <Input
                      label="Referência do pagamento"
                      value={draft.paymentReference}
                      onChange={(value) => patchDraft(row, { paymentReference: value })}
                      placeholder="ID da transação, comprovante..."
                    />
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-dim">
                    <div>Objetivo informado: {row.objective || "-"}</div>
                    <div>Criado em: {formatDate(row.created_at)}</div>
                    <div className="text-dim">
                      Vantagens do plano: {perks.join(" • ")}
                    </div>
                  </div>

                  <div className="mt-3">
                    <Input
                      label="Observações internas"
                      value={draft.notes}
                      onChange={(value) => patchDraft(row, { notes: value })}
                      placeholder="Anotações sobre aprovação, suporte, pagamento..."
                    />
                  </div>

                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <Button variant="secondary" onClick={() => savePayment(row)} disabled={busyId === row.id}>
                      Salvar pagamento
                    </Button>
                    <Button variant="danger" onClick={() => reject(row)} disabled={busyId === row.id}>
                      Rejeitar
                    </Button>
                    <Button onClick={() => approve(row)} disabled={busyId === row.id || draft.paymentStatus !== "paid"}>
                      Aprovar e liberar acesso
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState message="Nenhuma solicitação pendente no momento." />
        )}
      </Card>

      <Card title="Histórico de solicitações">
        {loading ? (
          <Skeleton rows={6} />
        ) : (
          <DataTable
            emptyMessage="Sem histórico de solicitações."
            headers={["Nome", "E-mail", "Plano", "Ciclo", "Status", "Pagamento", "Aprovado em"]}
            rows={history.map((row) => [
              row.full_name,
              row.email,
              labelFromOptions(row.requested_plan, PLAN_OPTIONS),
              labelFromOptions(row.requested_cycle, BILLING_CYCLE_OPTIONS),
              statusLabel(row.status),
              labelFromOptions(row.payment_status, REQUEST_PAYMENT_STATUS_OPTIONS),
              formatDate(row.approved_at || row.updated_at)
            ])}
          />
        )}
      </Card>
    </div>
  );
}

function TenantsPage() {
  const { token, query } = useConsoleContext();
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [name, setName] = useState("");
  const [plan, setPlan] = useState("starter");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson<{ ok: true; rows: Tenant[] }>("/api/admin/tenants", { token });
      setRows(response.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar clientes.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const createTenant = async () => {
    if (String(name).trim().length < 2) {
      setError("Informe um nome de cliente com pelo menos 2 caracteres.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await apiJson("/api/admin/tenants", { token, method: "POST", body: { name, plan, billingCycle } });
      setOpenCreate(false);
      setName("");
      setPlan("starter");
      setBillingCycle("monthly");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) => `${row.name} ${row.plan} ${row.status}`.toLowerCase().includes(q));

  return (
    <>
      <Card
        title="Clientes"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load().catch(() => undefined)}>
              Atualizar
            </Button>
            <Button onClick={() => setOpenCreate(true)}>Novo cliente</Button>
          </div>
        }
      >
        {error ? <Alert kind="error">{error}</Alert> : null}
        {loading ? <Skeleton rows={8} /> : <DataTable emptyMessage="Nenhum cliente cadastrado." headers={["Nome", "Plano", "Status", "Criado"]} rows={filtered.map((row) => [row.name, labelFromOptions(row.plan, PLAN_OPTIONS), statusLabel(row.status), formatDate(row.created_at)])} />}
      </Card>
      <Modal
        open={openCreate}
        title="Criar cliente"
        description="Provisiona tenant com assinatura e licenca iniciais."
        onClose={() => setOpenCreate(false)}
      >
        <div className="grid gap-3">
          <Input label="Nome do cliente" value={name} onChange={setName} placeholder="Cliente Alpha" />
          <SelectField
            label="Plano"
            value={plan}
            onChange={setPlan}
            options={PLAN_OPTIONS}
          />
          <SelectField
            label="Ciclo da assinatura"
            value={billingCycle}
            onChange={setBillingCycle}
            options={BILLING_CYCLE_OPTIONS}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCreate(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button onClick={createTenant} disabled={submitting || String(name).trim().length < 2}>
              {submitting ? "Criando..." : "Criar cliente"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function LicensesPage() {
  const { token, query } = useConsoleContext();
  const [rows, setRows] = useState<LicenseRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [plan, setPlan] = useState("starter");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [status, setStatus] = useState("active");
  const [expiresAt, setExpiresAt] = useState("");
  const [machineHash, setMachineHash] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [licensesResponse, tenantsResponse] = await Promise.all([
        apiJson<{ ok: true; rows: LicenseRow[] }>("/api/admin/licenses", { token }),
        apiJson<{ ok: true; rows: Tenant[] }>("/api/admin/tenants", { token })
      ]);
      setRows(licensesResponse.rows || []);
      setTenants(tenantsResponse.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar licencas.");
      setRows([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const createLicense = async () => {
    if (!tenantId) {
      setError("Selecione um cliente para emitir a licenca.");
      return;
    }
    if (expiresAt && Number.isNaN(new Date(expiresAt).getTime())) {
      setError("Data de expiracao invalida. Use formato ISO, por exemplo 2026-12-31T23:59:59Z.");
      return;
    }
    try {
      setError("");
      await apiJson("/api/admin/licenses", {
        token,
        method: "POST",
        body: { tenantId, plan, billingCycle, status, expiresAt: expiresAt || null, machineHash: machineHash || null }
      });
      setOpenCreate(false);
      setTenantId("");
      setPlan("starter");
      setBillingCycle("monthly");
      setStatus("active");
      setExpiresAt("");
      setMachineHash("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar licenca.");
    }
  };

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) => `${row.tenant_name} ${row.plan} ${row.status} ${row.machine_hash || ""}`.toLowerCase().includes(q));

  return (
    <>
      <Card
        title="Licencas"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load().catch(() => undefined)}>
              Atualizar
            </Button>
            <Button onClick={() => setOpenCreate(true)}>Nova licenca</Button>
          </div>
        }
      >
        {error ? <Alert kind="error">{error}</Alert> : null}
        {loading ? <Skeleton rows={8} /> : <DataTable emptyMessage="Nenhuma licença registrada." headers={["Cliente", "Plano", "Ciclo", "Status", "Expira em", "Máquina"]} rows={filtered.map((row) => [row.tenant_name, labelFromOptions(row.plan, PLAN_OPTIONS), labelFromOptions(String(row.billing_cycle || "monthly"), BILLING_CYCLE_OPTIONS), statusLabel(row.status), formatDate(row.expires_at), row.machine_hash || "-"])} />}
      </Card>
      <Modal
        open={openCreate}
        title="Emitir licenca"
        description="Cria nova licenca para cliente especifico."
        onClose={() => setOpenCreate(false)}
      >
        <div className="grid gap-3">
          <SelectField
            label="Cliente"
            value={tenantId}
            onChange={setTenantId}
            options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
            placeholder="Selecione um cliente"
          />
          <SelectField label="Plano" value={plan} onChange={setPlan} options={PLAN_OPTIONS} />
          <SelectField label="Ciclo da licença" value={billingCycle} onChange={setBillingCycle} options={BILLING_CYCLE_OPTIONS} />
          <SelectField label="Status" value={status} onChange={setStatus} options={LICENSE_STATUS_OPTIONS} />
          <Input label="Expira em (ISO)" value={expiresAt} onChange={setExpiresAt} placeholder="2026-12-31T23:59:59Z" />
          <Input label="Machine hash (opcional)" value={machineHash} onChange={setMachineHash} placeholder="sha256..." />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={createLicense} disabled={!tenantId}>Salvar</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function BillingPage() {
  const { token, query } = useConsoleContext();
  const [events, setEvents] = useState<BillingRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [tenantId, setTenantId] = useState("");
  const [plan, setPlan] = useState("starter");
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [amountCents, setAmountCents] = useState("4900");
  const [currency, setCurrency] = useState("BRL");
  const [dueInDays, setDueInDays] = useState("3");
  const [creating, setCreating] = useState(false);
  const [busyCancelId, setBusyCancelId] = useState("");
  const [pixData, setPixData] = useState<{
    invoiceId: string;
    copiaECola: string;
    qrCodeBase64: string;
    ticketUrl: string;
    amountCents: number;
    currency: string;
    dueAt: string;
  } | null>(null);
  const [feedback, setFeedback] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [invoicesResponse, billingResponse, tenantsResponse] = await Promise.all([
        apiJson<{ ok: true; rows: InvoiceRow[]; webhooks: WebhookRow[] }>("/api/admin/billing/invoices?all=1", { token }),
        apiJson<{ ok: true; rows: BillingRow[] }>("/api/admin/billing", { token }),
        apiJson<{ ok: true; rows: Tenant[] }>("/api/admin/tenants", { token })
      ]);
      setInvoices(invoicesResponse.rows || []);
      setWebhooks(invoicesResponse.webhooks || []);
      setEvents(billingResponse.rows || []);
      setTenants(tenantsResponse.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar cobranca.");
      setInvoices([]);
      setWebhooks([]);
      setEvents([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const createInvoice = async () => {
    if (!tenantId) {
      setError("Selecione o cliente da cobrança.");
      return;
    }
    if (!plan || !billingCycle) {
      setError("Plano e ciclo são obrigatórios para gerar cobrança.");
      return;
    }
    const amountValue = Number(amountCents || "0");
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Valor inválido. Informe centavos maiores que zero.");
      return;
    }
    const dueInDaysValue = Number(dueInDays || "3");
    if (!Number.isFinite(dueInDaysValue) || dueInDaysValue < 1 || dueInDaysValue > 30) {
      setError("Prazo inválido. Use de 1 a 30 dias.");
      return;
    }
    setCreating(true);
    setError("");
    setFeedback("");
    try {
      const response = await apiJson<{
        ok: true;
        invoiceId: string;
        amountCents: number;
        currency: string;
        dueAt: string;
        pix: { copiaECola: string; qrCodeBase64: string; ticketUrl: string };
      }>("/api/admin/billing/invoices", {
        token,
        method: "POST",
        body: {
          tenantId,
          plan,
          billingCycle,
          amountCents: amountValue,
          currency,
          dueInDays: dueInDaysValue
        }
      });
      setPixData({
        invoiceId: response.invoiceId,
        copiaECola: response.pix?.copiaECola || "",
        qrCodeBase64: response.pix?.qrCodeBase64 || "",
        ticketUrl: response.pix?.ticketUrl || "",
        amountCents: response.amountCents,
        currency: response.currency,
        dueAt: response.dueAt
      });
      setFeedback("Cobrança PIX gerada com sucesso.");
      setOpenCreate(false);
      setTenantId("");
      setPlan("starter");
      setBillingCycle("monthly");
      setAmountCents("4900");
      setCurrency("BRL");
      setDueInDays("3");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar cobrança PIX.");
    } finally {
      setCreating(false);
    }
  };

  const cancelInvoice = async (invoiceId: string) => {
    setBusyCancelId(invoiceId);
    setError("");
    setFeedback("");
    try {
      await apiJson(`/api/admin/billing/invoices/${invoiceId}/cancel`, {
        token,
        method: "POST"
      });
      setFeedback("Fatura cancelada com sucesso.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cancelar fatura.");
    } finally {
      setBusyCancelId("");
    }
  };

  const copyText = async (value: string, okMessage: string) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(okMessage);
    } catch {
      setError("Não foi possível copiar automaticamente. Copie manualmente.");
    }
  };

  const q = query.trim().toLowerCase();
  const filteredInvoices = invoices.filter((row) =>
    `${row.tenant_name || ""} ${row.status} ${row.id} ${row.external_id || ""}`.toLowerCase().includes(q)
  );
  const filteredEvents = events.filter((row) =>
    `${row.tenant_name || ""} ${row.status} ${row.reason}`.toLowerCase().includes(q)
  );
  const filteredWebhooks = webhooks.filter((row) =>
    `${row.provider} ${row.event_id} ${row.status}`.toLowerCase().includes(q)
  );

  return (
    <>
      <Card
        title="Cobrança PIX / Faturas"
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => load().catch(() => undefined)}>
              Atualizar
            </Button>
            <Button onClick={() => setOpenCreate(true)}>Gerar PIX</Button>
          </div>
        }
      >
        {error ? <Alert kind="error">{error}</Alert> : null}
        {feedback ? <Alert kind="success">{feedback}</Alert> : null}
        {loading ? (
          <Skeleton rows={8} />
        ) : filteredInvoices.length ? (
          <div className="overflow-auto rounded-xl border border-border">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-black/35 text-xs text-dim">
                <tr>
                  <th className="p-3 font-semibold">Cliente</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Plano / Ciclo</th>
                  <th className="p-3 font-semibold">Valor</th>
                  <th className="p-3 font-semibold">Vencimento</th>
                  <th className="p-3 font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((row) => {
                  const payload = compactJson(row.external_payload || "{}");
                  return (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="p-3 align-top text-xs">
                        <div className="font-semibold text-text">{row.tenant_name}</div>
                        <div className="text-mute">{row.id}</div>
                        {row.external_id ? <div className="text-mute">Ext: {row.external_id}</div> : null}
                      </td>
                      <td className="p-3 align-top text-xs">
                        <Badge
                          tone={
                            row.status === "paid"
                              ? "success"
                              : row.status === "failed" || row.status === "overdue" || row.status === "suspended"
                                ? "danger"
                                : "default"
                          }
                        >
                          {labelFromOptions(row.status, INVOICE_STATUS_OPTIONS)}
                        </Badge>
                      </td>
                      <td className="p-3 align-top text-xs">
                        <div>{labelFromOptions(String(row.plan || "starter"), PLAN_OPTIONS)}</div>
                        <div className="text-mute">{labelFromOptions(String(row.billing_cycle || "monthly"), BILLING_CYCLE_OPTIONS)}</div>
                        <div className="text-mute">{row.provider}</div>
                      </td>
                      <td className="p-3 align-top text-xs">{formatCurrency(row.amount_cents, row.currency)}</td>
                      <td className="p-3 align-top text-xs">
                        <div>{formatDate(row.due_at)}</div>
                        <div className="text-mute">Pago: {formatDate(row.paid_at)}</div>
                      </td>
                      <td className="p-3 align-top text-xs">
                        <div className="flex flex-wrap gap-2">
                          {row.status === "pending" || row.status === "overdue" ? (
                            <Button
                              variant="danger"
                              onClick={() => cancelInvoice(row.id)}
                              disabled={busyCancelId === row.id}
                            >
                              {busyCancelId === row.id ? "Cancelando..." : "Cancelar"}
                            </Button>
                          ) : null}
                          {row.external_payload ? (
                            <Button variant="secondary" onClick={() => copyText(payload, "Payload copiado para análise.")}>
                              Copiar payload
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="Sem faturas registradas." />
        )}
      </Card>

      {pixData ? (
        <Card title="PIX gerado" className="mt-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto]">
            <div className="grid gap-2">
              <div className="text-sm text-dim">Fatura: {pixData.invoiceId}</div>
              <div className="text-sm text-dim">
                Valor: {formatCurrency(pixData.amountCents, pixData.currency)} • vence em {formatDate(pixData.dueAt)}
              </div>
              <label className="grid gap-1">
                <span className="text-xs font-semibold text-dim">Copia e cola PIX</span>
                <textarea
                  value={pixData.copiaECola}
                  readOnly
                  rows={4}
                  className="rounded-xl border border-border bg-black/25 px-3 py-2 text-xs text-text outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => copyText(pixData.copiaECola, "PIX copia e cola copiado.")}>Copiar código PIX</Button>
                {pixData.ticketUrl ? (
                  <a href={pixData.ticketUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center rounded-xl border border-border bg-black/20 px-4 text-sm font-semibold text-text hover:border-white/25">
                    Abrir link do pagamento
                  </a>
                ) : null}
              </div>
            </div>
            <div className="flex items-center justify-center">
              {pixData.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pixData.qrCodeBase64}`}
                  alt="QR Code PIX"
                  className="h-[220px] w-[220px] rounded-xl border border-border bg-white p-2"
                />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-xl border border-border text-xs text-dim">
                  QR não disponível
                </div>
              )}
            </div>
          </div>
        </Card>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Webhooks de pagamento">
          {loading ? (
            <Skeleton rows={6} />
          ) : (
            <DataTable
              emptyMessage="Sem webhooks registrados."
              headers={["Data", "Provedor", "Evento", "Status", "Processado"]}
              rows={filteredWebhooks.map((row) => [
                formatDate(row.created_at),
                row.provider,
                row.event_id,
                row.status,
                formatDate(row.processed_at)
              ])}
            />
          )}
        </Card>
        <Card title="Eventos de cobrança (auditoria)">
          {loading ? (
            <Skeleton rows={6} />
          ) : (
            <DataTable
              emptyMessage="Sem eventos de cobrança."
              headers={["Cliente", "Status", "Motivo", "Valor", "Data"]}
              rows={filteredEvents.map((row) => [
                row.tenant_name || "-",
                labelFromOptions(row.status, BILLING_STATUS_OPTIONS),
                row.reason || "-",
                formatCurrency(row.amount_cents, row.currency),
                formatDate(row.created_at)
              ])}
            />
          )}
        </Card>
      </div>
      <Modal
        open={openCreate}
        title="Gerar cobrança PIX"
        description="Cria uma fatura com QR Code e copia-e-cola para cobrança automática."
        onClose={() => setOpenCreate(false)}
      >
        <div className="grid gap-3">
          <SelectField
            label="Cliente"
            value={tenantId}
            onChange={setTenantId}
            options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
            placeholder="Selecione um cliente"
          />
          <SelectField label="Plano" value={plan} onChange={setPlan} options={PLAN_OPTIONS} />
          <SelectField label="Ciclo" value={billingCycle} onChange={setBillingCycle} options={BILLING_CYCLE_OPTIONS} />
          <Input label="Valor (centavos)" value={amountCents} onChange={setAmountCents} placeholder="0" />
          <Input label="Vencimento (dias)" value={dueInDays} onChange={setDueInDays} placeholder="3" />
          <Input label="Moeda" value={currency} onChange={setCurrency} placeholder="BRL" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={createInvoice} disabled={creating || !tenantId}>
              {creating ? "Gerando..." : "Gerar PIX"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function UsersPage() {
  const { token, query } = useConsoleContext();
  const [users, setUsers] = useState<User[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openCreate, setOpenCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTenantId, setGrantTenantId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [usersResponse, linksResponse, tenantsResponse] = await Promise.all([
        apiJson<{ ok: true; rows: User[] }>("/api/admin/users", { token }),
        apiJson<{ ok: true; rows: LinkRow[] }>("/api/admin/links", { token }),
        apiJson<{ ok: true; rows: Tenant[] }>("/api/admin/tenants", { token })
      ]);
      setUsers(usersResponse.rows || []);
      setLinks(linksResponse.rows || []);
      setTenants(tenantsResponse.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar usuarios.");
      setUsers([]);
      setLinks([]);
      setTenants([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const createUser = async () => {
    if (!String(newEmail).trim().includes("@")) {
      setError("Informe um email valido para o novo usuario.");
      return;
    }
    if (String(newPassword).trim().length < 8) {
      setError("A senha inicial deve ter no minimo 8 caracteres.");
      return;
    }
    try {
      setError("");
      await apiJson("/api/admin/users", {
        token,
        method: "POST",
        body: { email: newEmail, password: newPassword, role: "user" }
      });
      setOpenCreate(false);
      setNewEmail("");
      setNewPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar usuario.");
    }
  };

  const grant = async () => {
    if (!grantUserId || !grantTenantId) {
      setError("Selecione usuario e cliente para criar o vinculo.");
      return;
    }
    try {
      setError("");
      await apiJson("/api/admin/grant", {
        token,
        method: "POST",
        body: { userId: grantUserId, tenantId: grantTenantId }
      });
      setGrantUserId("");
      setGrantTenantId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao vincular usuario.");
    }
  };

  const q = query.trim().toLowerCase();
  const usersFiltered = users.filter((row) => `${row.email} ${row.role}`.toLowerCase().includes(q));
  const linksFiltered = links.filter((row) => `${row.user_email} ${row.tenant_name}`.toLowerCase().includes(q));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Usuarios" action={<Button onClick={() => setOpenCreate(true)}>Novo usuario</Button>}>
          {error ? <Alert kind="error">{error}</Alert> : null}
          {loading ? <Skeleton rows={8} /> : <DataTable emptyMessage="Sem usuarios." headers={["Email", "Papel", "2FA", "Criado"]} rows={usersFiltered.map((row) => [row.email, row.role === "admin" ? "Admin" : "Usuario", row.totp_enabled ? "OK" : "Pendente", formatDate(row.created_at)])} />}
        </Card>
        <Card title="Vinculos usuario -> cliente">
          {loading ? <Skeleton rows={8} /> : <DataTable emptyMessage="Sem vinculos." headers={["Usuario", "Cliente", "Plano", "IDs"]} rows={linksFiltered.map((row) => [row.user_email, row.tenant_name, labelFromOptions(row.tenant_plan, PLAN_OPTIONS), `${row.user_id} -> ${row.tenant_id}`])} />}
        </Card>
      </div>
      <Card className="mt-4" title="Criar vinculo">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <SelectField
            label="Usuario"
            value={grantUserId}
            onChange={setGrantUserId}
            options={users.map((user) => ({ value: user.id, label: user.email }))}
            placeholder="Selecione um usuario"
          />
          <SelectField
            label="Cliente"
            value={grantTenantId}
            onChange={setGrantTenantId}
            options={tenants.map((tenant) => ({ value: tenant.id, label: tenant.name }))}
            placeholder="Selecione um cliente"
          />
          <div className="flex items-end lg:justify-end">
            <Button className="w-full lg:w-auto" onClick={grant} disabled={!grantUserId || !grantTenantId}>
              Vincular
            </Button>
          </div>
        </div>
      </Card>
      <Modal
        open={openCreate}
        title="Criar usuario"
        description="Cria conta de operador. 2FA deve ser habilitado no onboarding."
        onClose={() => setOpenCreate(false)}
      >
        <div className="grid gap-3">
          <Input label="Email" value={newEmail} onChange={setNewEmail} placeholder="cliente@dominio.com" />
          <Input label="Senha inicial" type="password" value={newPassword} onChange={setNewPassword} placeholder="Minimo 8 caracteres" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpenCreate(false)}>
              Cancelar
            </Button>
            <Button onClick={createUser} disabled={!String(newEmail).trim().includes("@") || String(newPassword).trim().length < 8}>
              Criar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function SecurityPage() {
  const { token } = useConsoleContext();
  const [payload, setPayload] = useState<SecurityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson<SecurityPayload>("/api/admin/security", { token });
      setPayload(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar seguranca.");
      setPayload(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  return (
    <Card title="Postura de seguranca" action={<Button variant="secondary" onClick={() => load().catch(() => undefined)}>Atualizar</Button>}>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {loading ? <Skeleton rows={7} /> : null}
      {!loading && payload ? (
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Usuarios totais" value={String(payload.stats.totalUsers)} />
            <KpiCard label="Usuarios com 2FA" value={String(payload.stats.usersWith2FA)} />
            <KpiCard label="Cobertura 2FA" value={`${payload.stats.twoFactorCoveragePct}%`} />
            <KpiCard label="Modo master" value={payload.stats.masterMode ? "ATIVO" : "INATIVO"} />
          </div>
          <DataTable emptyMessage="Sem administradores." headers={["Admin", "Criado em"]} rows={payload.admins.map((admin) => [admin.email, formatDate(admin.created_at)])} />
        </div>
      ) : null}
    </Card>
  );
}

function AuditPage() {
  const { token, query } = useConsoleContext();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiJson<{ ok: true; rows: AuditRow[] }>("/api/admin/audit", { token });
      setRows(response.rows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar auditoria.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  const q = query.trim().toLowerCase();
  const filtered = rows.filter((row) => `${row.action} ${row.user_id || ""} ${row.tenant_id || ""} ${row.detail_json || ""}`.toLowerCase().includes(q));

  return (
    <Card title="Logs de auditoria" action={<Button variant="secondary" onClick={() => load().catch(() => undefined)}>Atualizar</Button>}>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {loading ? <Skeleton rows={10} /> : <DataTable emptyMessage="Sem logs de auditoria." headers={["Data", "Acao", "Usuario", "Cliente", "Detalhe"]} rows={filtered.map((row) => [formatDate(row.ts), row.action, row.user_id || "-", row.tenant_id || "-", compactJson(row.detail_json)])} />}
    </Card>
  );
}

function SettingsPage() {
  const { token } = useConsoleContext();
  const [settings, setSettings] = useState<SettingsPayload["settings"] | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [mobile, setMobile] = useState<MobileConnectSettings>({
    mode: "local",
    lanHost: "",
    apiPort: 8502,
    customBaseUrl: "",
    token: "local-dev"
  });
  const [mobileMsg, setMobileMsg] = useState("");
  const [savingMobile, setSavingMobile] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const buildMobileBaseUrl = (cfg: MobileConnectSettings) => {
    if (cfg.mode === "custom") return String(cfg.customBaseUrl || "").trim().replace(/\/+$/, "");
    if (cfg.mode === "lan") {
      const host = String(cfg.lanHost || "").trim();
      if (!host) return "";
      return `http://${host}:${cfg.apiPort}`;
    }
    return `http://localhost:${cfg.apiPort}`;
  };

  const mobileBaseUrlPreview = useMemo(() => buildMobileBaseUrl(mobile), [mobile]);

  useEffect(() => {
    const baseUrl = mobileBaseUrlPreview;
    if (!baseUrl) {
      setQrDataUrl("");
      return;
    }
    const payload = JSON.stringify({
      kind: "helpsystem-connect",
      v: 1,
      baseUrl,
      token: String(mobile.token || "").trim()
    });
    QRCode.toDataURL(payload, { margin: 1, scale: 6 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(""));
  }, [mobileBaseUrlPreview, mobile.token]);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [settingsResponse, publicResponse] = await Promise.all([
        apiJson<SettingsPayload>("/api/admin/settings", { token }),
        apiJson<PublicConfig>("/api/public/config")
      ]);
      setSettings(settingsResponse.settings);
      setPublicConfig(publicResponse);
      const saved = settingsResponse.mobileConnect || settingsResponse.settings.mobileConnect;
      if (saved) {
        setMobile({
          mode: saved.mode || "local",
          lanHost: saved.lanHost || "",
          apiPort: Number(saved.apiPort || 8502),
          customBaseUrl: saved.customBaseUrl || "",
          token: saved.token || "local-dev"
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao carregar configuracoes.");
      setSettings(null);
      setPublicConfig(null);
    } finally {
      setLoading(false);
    }
  };

  const saveMobile = async () => {
    setMobileMsg("");
    if (mobile.mode === "lan" && !String(mobile.lanHost).trim()) {
      setMobileMsg("No modo LAN, informe o IP/host da API.");
      return;
    }
    if (mobile.mode === "custom" && !String(mobile.customBaseUrl).trim()) {
      setMobileMsg("No modo URL personalizada, informe a URL base da API.");
      return;
    }
    if (!String(mobile.token).trim()) {
      setMobileMsg("Informe o token usado pelo app mobile.");
      return;
    }
    setSavingMobile(true);
    try {
      const response = await apiJson<{ ok: true; settings: MobileConnectSettings; baseUrlPreview: string }>(
        "/api/admin/mobile-connect-settings",
        {
          token,
          method: "POST",
          body: mobile
        }
      );
      setMobile(response.settings);
      setMobileMsg(`Configuração salva. Base URL ativa: ${response.baseUrlPreview || "(vazia)"}`);
    } catch (err) {
      setMobileMsg(err instanceof Error ? err.message : "Falha ao salvar configuração mobile.");
    } finally {
      setSavingMobile(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [token]);

  return (
    <div className="grid gap-4">
      <Card title="Configuracoes gerais" action={<Button variant="secondary" onClick={() => load().catch(() => undefined)}>Atualizar</Button>}>
        {error ? <Alert kind="error">{error}</Alert> : null}
        {loading ? <Skeleton rows={6} /> : null}
        {!loading && settings ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SettingLine label="Ambiente" value={environmentLabel(settings.environment)} />
              <SettingLine label="Base URL" value={settings.baseUrl} />
              <SettingLine label="Porta da API" value={String(settings.apiPort)} />
              <SettingLine label="Operador" value={settings.operatorEmail} />
              <SettingLine label="Modo master" value={settings.masterMode ? "ATIVO" : "INATIVO"} />
              <SettingLine label="Master (mascarado)" value={publicConfig?.masterEmailHint || "-"} />
            </div>
            <Alert kind="info">
              O email master e controlado por <span className="font-mono">HSP_MASTER_EMAIL</span> no
              <span className="font-mono"> .env.docker.full</span>. Para trocar o master, altere a variavel e recrie os
              containers.
            </Alert>
          </>
        ) : null}
      </Card>

      <Card
        title="Conexão Mobile (QR Code)"
        action={
          <Button
            onClick={saveMobile}
            disabled={
              savingMobile ||
              !String(mobile.token).trim() ||
              (mobile.mode === "lan" && !String(mobile.lanHost).trim()) ||
              (mobile.mode === "custom" && !String(mobile.customBaseUrl).trim())
            }
          >
            {savingMobile ? "Salvando..." : "Salvar conexão mobile"}
          </Button>
        }
      >
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold text-dim">Modo da API para app</span>
              <select
                value={mobile.mode}
                onChange={(event) =>
                  setMobile((prev) => ({ ...prev, mode: event.target.value as MobileConnectSettings["mode"] }))
                }
                className="h-11 rounded-xl border border-border bg-black/25 px-3 text-sm text-text outline-none transition focus:border-accent/45"
              >
                <option value="local">Local teste (localhost)</option>
                <option value="lan">LAN (IP da máquina)</option>
                <option value="custom">URL personalizada (VPS/HTTPS)</option>
              </select>
            </label>

            {mobile.mode === "lan" ? (
              <Input
                label="IP/Host da API no LAN"
                value={mobile.lanHost}
                onChange={(value) => setMobile((prev) => ({ ...prev, lanHost: value }))}
                placeholder="ex: 192.168.15.138"
              />
            ) : null}

            {mobile.mode === "custom" ? (
              <Input
                label="URL base da API"
                value={mobile.customBaseUrl}
                onChange={(value) => setMobile((prev) => ({ ...prev, customBaseUrl: value }))}
                placeholder="https://api.seudominio.com"
              />
            ) : null}

            <Input
              label="Porta da API"
              value={String(mobile.apiPort || 8502)}
              onChange={(value) => setMobile((prev) => ({ ...prev, apiPort: Number(value || 8502) }))}
              placeholder="8502"
            />

            <Input
              label="Token para o app mobile"
              value={mobile.token}
              onChange={(value) => setMobile((prev) => ({ ...prev, token: value }))}
              placeholder="local-dev"
            />

            <Alert kind="info">
              Base URL prévia: <span className="font-mono">{mobileBaseUrlPreview || "(informe os campos acima)"}</span>
            </Alert>
            {mobile.mode === "lan" ? (
              <Alert kind="info">
                Para funcionar no celular em Docker, use <span className="font-mono">HSP_BIND_ADDR=0.0.0.0</span> no
                <span className="font-mono"> .env.docker.full</span> e reinicie o compose.
              </Alert>
            ) : null}
            {mobileMsg ? <Alert kind={mobileMsg.startsWith("Configuração salva") ? "success" : "error"}>{mobileMsg}</Alert> : null}
          </div>

          <div className="rounded-xl border border-border bg-black/20 p-3">
            <div className="text-sm font-semibold">QR para o app mobile</div>
            <p className="mt-1 text-xs text-dim">
              Escaneie no app (tela de conexão). A configuração fica salva no servidor e permanece após logout/login.
            </p>
            <div className="mt-3 flex justify-center">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="QR de conexão mobile" className="h-[220px] w-[220px] rounded-lg border border-border bg-white p-2" />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center rounded-lg border border-border text-xs text-dim">
                  Preencha os campos para gerar QR
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AuthShell({
  title,
  subtitle,
  rightLink,
  children
}: {
  title: string;
  subtitle: string;
  rightLink?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="mx-auto max-w-3xl p-4 lg:p-8">
        <Card className="p-6 lg:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl font-black">{title}</h1>
              <p className="mt-1 text-sm text-dim">{subtitle}</p>
            </div>
            {rightLink}
          </div>
          <div className="mt-6">{children}</div>
        </Card>
      </div>
    </div>
  );
}

function Stepper({
  steps
}: {
  steps: Array<{ title: string; active: boolean; done: boolean }>;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {steps.map((step) => (
        <div
          key={step.title}
          className={`rounded-xl border px-3 py-2 text-sm ${
            step.active
              ? "border-accent/45 bg-accent/20 text-accent"
              : step.done
                ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
                : "border-border bg-black/25 text-dim"
          }`}
        >
          {step.title}
        </div>
      ))}
    </div>
  );
}

function useConsoleContext() {
  return useOutletContext<ConsoleContext>();
}

function FeatureBadge({ label }: { label: string }) {
  return <div className="rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-dim">{label}</div>;
}

function KpiCard({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "danger" }) {
  return (
    <Card className={`p-4 ${tone === "danger" ? "border-red-500/35" : ""}`}>
      <div className="text-xs uppercase tracking-wide text-mute">{label}</div>
      <div className={`mt-2 text-2xl font-black ${tone === "danger" ? "text-red-300" : "text-text"}`}>{value}</div>
    </Card>
  );
}

function Card({
  title,
  action,
  className = "",
  children
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`rounded-2xl border border-border bg-panel ${className}`}>
      {title || action ? (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h3 className="text-lg font-extrabold">{title}</h3>
          {action}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  className = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`grid gap-1 ${className}`}>
      {label ? <span className="text-xs font-semibold text-dim">{label}</span> : null}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 rounded-xl border border-border bg-black/25 px-3 text-sm text-text outline-none transition placeholder:text-mute focus:border-accent/45"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder = ""
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      {label ? <span className="text-xs font-semibold text-dim">{label}</span> : null}
      <div className="relative min-w-0">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-11 w-full min-w-0 appearance-none rounded-xl border border-border bg-black/25 px-3 pr-10 text-sm text-text outline-none transition focus:border-accent/45"
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mute">▼</span>
      </div>
    </label>
  );
}

function Button({
  children,
  onClick,
  disabled = false,
  variant = "primary"
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const classes =
    variant === "primary"
      ? "border-accent/45 bg-accent text-black hover:brightness-110"
      : variant === "danger"
        ? "border-red-500/45 bg-red-500/15 text-red-200 hover:bg-red-500/25"
        : "border-border bg-black/20 text-text hover:border-white/25";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${classes}`}
    >
      {children}
    </button>
  );
}

function Badge({
  children,
  tone = "default"
}: {
  children: ReactNode;
  tone?: "default" | "success" | "danger";
}) {
  const classes =
    tone === "success"
      ? "border-emerald-500/35 bg-emerald-500/15 text-emerald-300"
      : tone === "danger"
        ? "border-red-500/35 bg-red-500/15 text-red-300"
        : "border-border bg-black/20 text-dim";
  return <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}>{children}</span>;
}

function Alert({
  kind,
  children
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const classes =
    kind === "error"
      ? "border-red-500/35 bg-red-500/12 text-red-200"
      : kind === "success"
        ? "border-emerald-500/35 bg-emerald-500/12 text-emerald-200"
        : "border-border bg-black/20 text-dim";
  return <div className={`rounded-xl border px-3 py-2 text-sm ${classes}`}>{children}</div>;
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-lg border border-border bg-black/20" />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-black/20 p-8 text-center text-sm text-dim">
      {message}
    </div>
  );
}

function DataTable({
  headers,
  rows,
  emptyMessage
}: {
  headers: string[];
  rows: string[][];
  emptyMessage: string;
}) {
  if (!rows.length) return <EmptyState message={emptyMessage} />;
  return (
    <div className="overflow-auto rounded-xl border border-border">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-black/35 text-xs text-dim">
          <tr>
            {headers.map((header) => (
              <th key={header} className="p-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t border-border/60">
              {row.map((value, colIndex) => (
                <td key={`${rowIndex}-${colIndex}`} className="p-3 align-top text-xs text-text">
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Modal({
  open,
  title,
  description,
  onClose,
  children
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-lg font-bold">{title}</h4>
            {description ? <p className="mt-1 text-sm text-dim">{description}</p> : null}
          </div>
          <Button variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function SettingLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-black/25 p-3">
      <div className="text-xs text-mute">{label}</div>
      <div className="mt-1 text-sm font-medium text-text">{value || "-"}</div>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR");
}

function formatCurrency(amountCents: number, currency: string) {
  const amount = Number(amountCents || 0) / 100;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currency || "BRL"
  }).format(amount);
}

function compactJson(text: string) {
  if (!text) return "-";
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed);
  } catch {
    return text;
  }
}

export default App;

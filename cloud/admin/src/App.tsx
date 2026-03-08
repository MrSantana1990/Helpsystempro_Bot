import { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Field from "./ui/Field";
import { apiJson } from "./lib/api";

type LoginRes = { ok: true; token: string; role: string; tenantIds: string[] };
type MeRes = { ok: true; user: any; tenantIds: string[] };
type PublicConfigRes = { ok: true; masterMode: boolean; masterEmailHint: string; masterEmail: string };
type LinkRow = { user_id: string; tenant_id: string; user_email: string; tenant_name: string; tenant_plan: string };

type SectionKey = "overview" | "users" | "tenants" | "links" | "security";

const NAV: Array<{ key: SectionKey; label: string }> = [
  { key: "overview", label: "Visao Geral" },
  { key: "users", label: "Usuarios" },
  { key: "tenants", label: "Clientes" },
  { key: "links", label: "Vinculos" },
  { key: "security", label: "Seguranca" }
];

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("hsp_cloud_token") || "");
  const [msg, setMsg] = useState("");
  const [me, setMe] = useState<any>(null);
  const [section, setSection] = useState<SectionKey>("overview");

  const [publicCfg, setPublicCfg] = useState<PublicConfigRes | null>(null);

  const [bootstrapCode, setBootstrapCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [qr, setQr] = useState<string>("");

  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantPlan, setNewTenantPlan] = useState("starter");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTenantId, setGrantTenantId] = useState("");

  const authed = useMemo(() => !!token, [token]);
  const counts = useMemo(
    () => ({
      users: users.length,
      tenants: tenants.length,
      links: links.length,
      admins: users.filter((x) => String(x.role || "") === "admin").length
    }),
    [links.length, tenants.length, users]
  );

  const refresh = async () => {
    if (!token) return;
    const meRes = await apiJson<MeRes>("/api/me", { token });
    setMe(meRes.user);
    const usersRes = await apiJson<{ ok: true; rows: any[] }>("/api/admin/users", { token });
    setUsers(usersRes.rows || []);
    const tenantRes = await apiJson<{ ok: true; rows: any[] }>("/api/admin/tenants", { token });
    setTenants(tenantRes.rows || []);
    const linksRes = await apiJson<{ ok: true; rows: LinkRow[] }>("/api/admin/links", { token });
    setLinks(linksRes.rows || []);
  };

  useEffect(() => {
    apiJson<PublicConfigRes>("/api/public/config")
      .then((r) => setPublicCfg(r))
      .catch(() => setPublicCfg(null));
  }, []);

  useEffect(() => {
    localStorage.setItem("hsp_cloud_token", token || "");
    if (token) refresh().catch((e) => setMsg("Erro: " + String(e?.message || e)));
  }, [token]);

  const doBootstrap = async () => {
    setMsg("");
    await apiJson("/api/bootstrap-admin", { method: "POST", body: { bootstrapCode, email, password } });
    setMsg("OK: master criado. Proximo passo: gerar QR 2FA, ativar 2FA e fazer login.");
  };

  const totpStart = async () => {
    setMsg("");
    const r = await apiJson<{ ok: true; otpauth: string; qrDataUrl: string }>("/api/totp/setup-start", {
      method: "POST",
      body: { email, password }
    });
    setQr(r.qrDataUrl || "");
    setMsg("OK: QR gerado. Escaneie no Google Authenticator e confirme o codigo.");
  };

  const totpEnable = async () => {
    setMsg("");
    await apiJson("/api/totp/enable", { method: "POST", body: { email, password, code: totp } });
    setMsg("OK: 2FA habilitado. Agora faca login.");
  };

  const doLogin = async () => {
    setMsg("");
    const r = await apiJson<LoginRes>("/api/login", { method: "POST", body: { email, password, totp } });
    setToken(r.token);
    setSection("overview");
    setMsg("OK: login efetuado.");
  };

  const logout = () => {
    setToken("");
    setMe(null);
    setUsers([]);
    setTenants([]);
    setLinks([]);
  };

  const createUser = async () => {
    setMsg("");
    await apiJson("/api/admin/users", { token, method: "POST", body: { email: newUserEmail, password: newUserPassword, role: "user" } });
    setNewUserEmail("");
    setNewUserPassword("");
    setMsg("OK: usuario criado.");
    await refresh();
  };

  const createTenant = async () => {
    setMsg("");
    await apiJson("/api/admin/tenants", { token, method: "POST", body: { name: newTenantName, plan: newTenantPlan } });
    setNewTenantName("");
    setMsg("OK: cliente criado.");
    await refresh();
  };

  const doGrant = async () => {
    setMsg("");
    await apiJson("/api/admin/grant", { token, method: "POST", body: { userId: grantUserId, tenantId: grantTenantId } });
    setMsg("OK: vinculo criado.");
    await refresh();
  };

  if (!authed) {
    return (
      <div className="min-h-full bg-bg text-text">
        <div className="mx-auto flex min-h-full w-full max-w-[1240px] flex-col gap-4 p-4 lg:p-6">
          <div className="rounded-2xl border border-border bg-panel p-5 shadow-soft">
            <div className="text-2xl font-black tracking-wide">HelpSystem Pro | Master Console</div>
            <div className="mt-2 text-sm text-dim">
              Painel central de governanca. Somente a conta master pode gerenciar usuarios, clientes e vinculos.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-border bg-black/20 px-3 py-1">
                {publicCfg?.masterMode ? `MASTER MODE: ON (${publicCfg.masterEmailHint || publicCfg.masterEmail})` : "MASTER MODE: OFF"}
              </span>
              <span className="rounded-full border border-border bg-black/20 px-3 py-1">2FA obrigatorio</span>
              <span className="rounded-full border border-border bg-black/20 px-3 py-1">JWT + auditoria</span>
            </div>
          </div>

          {msg ? <div className="rounded-xl border border-border bg-black/20 p-3 text-sm text-dim">{msg}</div> : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="Login master">
              <div className="grid gap-3">
                <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="master@dominio.com" />
                <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="sua senha" />
                <Field label="Codigo 2FA (TOTP)" value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="6 digitos" />
                <Button onClick={() => doLogin().catch((e) => setMsg("Erro: " + e.message))}>Entrar</Button>
              </div>
              <div className="mt-3 text-xs text-mute">Sem 2FA nao entra.</div>
            </Card>

            <Card title="Primeiro acesso (bootstrap)">
              <div className="grid gap-3">
                <Field label="Bootstrap code" value={bootstrapCode} onChange={(e) => setBootstrapCode(e.target.value)} placeholder="HSP_BOOTSTRAP_CODE" />
                <Field label="Email master" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="master@dominio.com" />
                <Field label="Senha inicial" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="minimo 8 chars" />
                <Button onClick={() => doBootstrap().catch((e) => setMsg("Erro: " + e.message))}>Criar master</Button>
              </div>
              <div className="mt-3 text-xs text-mute">Executa apenas uma vez.</div>
            </Card>

            <Card title="Setup 2FA">
              <div className="grid gap-3">
                <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="secondary" onClick={() => totpStart().catch((e) => setMsg("Erro: " + e.message))}>
                  Gerar QR
                </Button>
                {qr ? (
                  <div className="rounded-xl border border-border bg-black/20 p-3">
                    <div className="text-xs font-bold text-dim">QR 2FA</div>
                    <img alt="QR 2FA" className="mt-2 w-full rounded-lg border border-border" src={qr} />
                  </div>
                ) : null}
                <Field label="Confirmar codigo" value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="6 digitos" />
                <Button onClick={() => totpEnable().catch((e) => setMsg("Erro: " + e.message))}>Ativar 2FA</Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-bg text-text">
      <div className="mx-auto flex min-h-full w-full max-w-[1400px] gap-4 p-4 lg:p-6">
        <aside className="hidden w-[260px] shrink-0 rounded-2xl border border-border bg-panel p-4 shadow-soft lg:block">
          <div className="text-xl font-black">Master Console</div>
          <div className="mt-1 text-xs text-dim">Controle central do projeto</div>
          <div className="mt-4 rounded-xl border border-border bg-black/20 p-3 text-xs">
            <div className="font-mono text-dim">{me?.email || "-"}</div>
            <div className="mt-1 text-mute">Role: {me?.role || "-"}</div>
          </div>
          <div className="mt-4 grid gap-2">
            {NAV.map((item) => (
              <button
                key={item.key}
                className={`rounded-xl border px-3 py-2 text-left text-sm font-bold transition ${
                  section === item.key ? "border-yellow-300/40 bg-accent text-black" : "border-border bg-black/20 text-text hover:border-white/25"
                }`}
                onClick={() => setSection(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-2">
            <Button variant="secondary" onClick={() => refresh().catch((e) => setMsg("Erro: " + e.message))}>
              Atualizar tudo
            </Button>
            <Button variant="danger" onClick={logout}>
              Sair
            </Button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="rounded-2xl border border-border bg-panel p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-black">HelpSystem Pro Admin</div>
                <div className="text-sm text-dim">Master-only management de usuarios, clientes e vinculos</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full border border-border bg-black/20 px-3 py-1">{publicCfg?.masterMode ? "master mode ON" : "master mode OFF"}</span>
                <span className="rounded-full border border-border bg-black/20 px-3 py-1">usuarios: {counts.users}</span>
                <span className="rounded-full border border-border bg-black/20 px-3 py-1">clientes: {counts.tenants}</span>
                <span className="rounded-full border border-border bg-black/20 px-3 py-1">vinculos: {counts.links}</span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 lg:hidden">
              {NAV.map((item) => (
                <button
                  key={item.key}
                  className={`rounded-xl border px-3 py-2 text-sm font-bold transition ${
                    section === item.key ? "border-yellow-300/40 bg-accent text-black" : "border-border bg-black/20 text-text hover:border-white/25"
                  }`}
                  onClick={() => setSection(item.key)}
                >
                  {item.label}
                </button>
              ))}
              <Button variant="secondary" onClick={() => refresh().catch((e) => setMsg("Erro: " + e.message))}>
                Atualizar
              </Button>
              <Button variant="danger" onClick={logout}>
                Sair
              </Button>
            </div>
          </div>

          {msg ? <div className="mt-4 rounded-xl border border-border bg-black/20 p-3 text-sm text-dim">{msg}</div> : null}

          {section === "overview" ? (
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-4">
              <Card title="Usuarios">
                <div className="text-3xl font-black">{counts.users}</div>
                <div className="mt-1 text-xs text-dim">Admins: {counts.admins}</div>
              </Card>
              <Card title="Clientes">
                <div className="text-3xl font-black">{counts.tenants}</div>
                <div className="mt-1 text-xs text-dim">Planos ativos no banco</div>
              </Card>
              <Card title="Vinculos">
                <div className="text-3xl font-black">{counts.links}</div>
                <div className="mt-1 text-xs text-dim">Usuario x Cliente</div>
              </Card>
              <Card title="Master">
                <div className="text-sm font-mono">{publicCfg?.masterEmail || "-"}</div>
                <div className="mt-1 text-xs text-dim">Conta com permissao total</div>
              </Card>
            </div>
          ) : null}

          {section === "users" ? (
            <div className="mt-4">
              <Card title="Usuarios (somente role=user)">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="cliente@dominio.com" />
                  <Field label="Senha inicial" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="minimo 8 chars" />
                  <div className="flex items-end">
                    <Button className="w-full" onClick={() => createUser().catch((e) => setMsg("Erro: " + e.message))}>
                      Criar usuario
                    </Button>
                  </div>
                </div>
                <div className="mt-4 overflow-auto rounded-xl border border-border bg-black/10">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-black/40 text-xs text-dim">
                      <tr>
                        <th className="p-2">id</th>
                        <th className="p-2">email</th>
                        <th className="p-2">role</th>
                        <th className="p-2">2FA</th>
                        <th className="p-2">criado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-border/60">
                          <td className="p-2 font-mono text-xs">{u.id}</td>
                          <td className="p-2">{u.email}</td>
                          <td className="p-2 font-mono text-xs">{u.role}</td>
                          <td className="p-2 font-mono text-xs">{u.totp_enabled ? "OK" : "-"}</td>
                          <td className="p-2 font-mono text-xs">{String(u.created_at || "").slice(0, 19).replace("T", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}

          {section === "tenants" ? (
            <div className="mt-4">
              <Card title="Clientes / Tenants">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Field label="Nome" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="Cliente X" />
                  <Field label="Plano" value={newTenantPlan} onChange={(e) => setNewTenantPlan(e.target.value)} placeholder="starter | pro | premium" />
                  <div className="flex items-end">
                    <Button className="w-full" onClick={() => createTenant().catch((e) => setMsg("Erro: " + e.message))}>
                      Criar cliente
                    </Button>
                  </div>
                </div>
                <div className="mt-4 overflow-auto rounded-xl border border-border bg-black/10">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="bg-black/40 text-xs text-dim">
                      <tr>
                        <th className="p-2">id</th>
                        <th className="p-2">nome</th>
                        <th className="p-2">plano</th>
                        <th className="p-2">status</th>
                        <th className="p-2">criado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map((t) => (
                        <tr key={t.id} className="border-t border-border/60">
                          <td className="p-2 font-mono text-xs">{t.id}</td>
                          <td className="p-2">{t.name}</td>
                          <td className="p-2 font-mono text-xs">{t.plan}</td>
                          <td className="p-2 font-mono text-xs">{t.status}</td>
                          <td className="p-2 font-mono text-xs">{String(t.created_at || "").slice(0, 19).replace("T", " ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}

          {section === "links" ? (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card title="Vincular usuario -> cliente">
                <div className="grid gap-3">
                  <Field label="userId" value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="usr_xxx" />
                  <Field label="tenantId" value={grantTenantId} onChange={(e) => setGrantTenantId(e.target.value)} placeholder="tnt_xxx" />
                  <Button onClick={() => doGrant().catch((e) => setMsg("Erro: " + e.message))}>Criar vinculo</Button>
                </div>
              </Card>

              <Card title="Vinculos existentes">
                <div className="overflow-auto rounded-xl border border-border bg-black/10">
                  <table className="w-full min-w-[700px] text-left text-sm">
                    <thead className="bg-black/40 text-xs text-dim">
                      <tr>
                        <th className="p-2">usuario</th>
                        <th className="p-2">cliente</th>
                        <th className="p-2">plano</th>
                        <th className="p-2">userId</th>
                        <th className="p-2">tenantId</th>
                      </tr>
                    </thead>
                    <tbody>
                      {links.map((l, idx) => (
                        <tr key={`${l.user_id}-${l.tenant_id}-${idx}`} className="border-t border-border/60">
                          <td className="p-2">{l.user_email}</td>
                          <td className="p-2">{l.tenant_name}</td>
                          <td className="p-2 font-mono text-xs">{l.tenant_plan}</td>
                          <td className="p-2 font-mono text-xs">{l.user_id}</td>
                          <td className="p-2 font-mono text-xs">{l.tenant_id}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ) : null}

          {section === "security" ? (
            <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card title="Master mode">
                <div className="grid gap-2 text-sm text-dim">
                  <div>Status: {publicCfg?.masterMode ? "ON" : "OFF"}</div>
                  <div>Master email: <span className="font-mono text-text">{publicCfg?.masterEmail || "-"}</span></div>
                  <div className="text-xs text-mute">
                    Se `HSP_MASTER_EMAIL` estiver definido no servidor, somente essa conta pode usar rotas administrativas.
                  </div>
                </div>
              </Card>
              <Card title="Compliance">
                <div className="text-sm text-dim">
                  <div>Nao e recomendacao financeira.</div>
                  <div>Nao ha garantia de lucro.</div>
                  <div>Use limites de risco e trilha de auditoria.</div>
                </div>
              </Card>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}


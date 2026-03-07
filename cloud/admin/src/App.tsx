import { useEffect, useMemo, useState } from "react";
import Card from "./ui/Card";
import Button from "./ui/Button";
import Field from "./ui/Field";
import { apiJson } from "./lib/api";

type LoginRes = { ok: true; token: string; role: string; tenantIds: string[] };
type MeRes = { ok: true; user: any; tenantIds: string[] };

export default function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem("hsp_cloud_token") || "");
  const [msg, setMsg] = useState("");
  const [me, setMe] = useState<any>(null);

  const [bootstrapCode, setBootstrapCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [qr, setQr] = useState<string>("");

  const [users, setUsers] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"user" | "admin">("user");
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantPlan, setNewTenantPlan] = useState("starter");
  const [grantUserId, setGrantUserId] = useState("");
  const [grantTenantId, setGrantTenantId] = useState("");

  const authed = useMemo(() => !!token, [token]);

  const refresh = async () => {
    if (!token) return;
    const r = await apiJson<MeRes>("/api/me", { token });
    setMe(r.user);
    const u = await apiJson<{ ok: true; rows: any[] }>("/api/admin/users", { token });
    setUsers(u.rows || []);
    const t = await apiJson<{ ok: true; rows: any[] }>("/api/admin/tenants", { token });
    setTenants(t.rows || []);
  };

  useEffect(() => {
    localStorage.setItem("hsp_cloud_token", token || "");
    if (token) refresh().catch(() => {});
  }, [token]);

  const doBootstrap = async () => {
    setMsg("");
    await apiJson("/api/bootstrap-admin", { method: "POST", body: { bootstrapCode, email, password } });
    setMsg("OK: admin criado. Agora faça o setup do 2FA (aba abaixo) e depois login.");
  };

  const totpStart = async () => {
    setMsg("");
    const r = await apiJson<{ ok: true; otpauth: string; qrDataUrl: string }>("/api/totp/setup-start", {
      method: "POST",
      body: { email, password }
    });
    setQr(r.qrDataUrl || "");
    setMsg("OK: QR gerado. Escaneie no Google Authenticator e confirme o código.");
  };

  const totpEnable = async () => {
    setMsg("");
    await apiJson("/api/totp/enable", { method: "POST", body: { email, password, code: totp } });
    setMsg("OK: 2FA habilitado. Agora faça login.");
  };

  const doLogin = async () => {
    setMsg("");
    const r = await apiJson<LoginRes>("/api/login", { method: "POST", body: { email, password, totp } });
    setToken(r.token);
    setMsg("OK: logado.");
  };

  const logout = () => {
    setToken("");
    setMe(null);
    setUsers([]);
    setTenants([]);
  };

  const createUser = async () => {
    setMsg("");
    await apiJson("/api/admin/users", { token, method: "POST", body: { email: newUserEmail, password: newUserPassword, role: newUserRole } });
    setNewUserEmail("");
    setNewUserPassword("");
    setMsg("OK: usuário criado (ele precisa habilitar 2FA no primeiro acesso).");
    await refresh();
  };

  const createTenant = async () => {
    setMsg("");
    await apiJson("/api/admin/tenants", { token, method: "POST", body: { name: newTenantName, plan: newTenantPlan } });
    setNewTenantName("");
    setMsg("OK: tenant criado.");
    await refresh();
  };

  const doGrant = async () => {
    setMsg("");
    await apiJson("/api/admin/grant", { token, method: "POST", body: { userId: grantUserId, tenantId: grantTenantId } });
    setMsg("OK: vínculo criado.");
    await refresh();
  };

  return (
    <div className="min-h-full bg-bg">
      <div className="mx-auto flex min-h-full max-w-[1100px] flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-panel p-4 shadow-soft">
          <div>
            <div className="text-lg font-black tracking-wide">HelpSystem Pro • Admin</div>
            <div className="text-xs text-dim">Plataforma Cloud (usuários + tenants + 2FA obrigatório)</div>
          </div>
          <div className="flex items-center gap-2">
            {authed ? (
              <>
                <div className="rounded-full border border-border bg-black/20 px-3 py-1 text-xs font-mono text-dim">
                  {me?.email || "admin"}
                </div>
                <Button variant="secondary" onClick={() => refresh().catch((e) => setMsg("Erro: " + e.message))}>Atualizar</Button>
                <Button variant="danger" onClick={logout}>Sair</Button>
              </>
            ) : (
              <div className="rounded-full border border-border bg-black/20 px-3 py-1 text-xs font-mono text-dim">não autenticado</div>
            )}
          </div>
        </div>

        {msg ? <div className="rounded-xl border border-border bg-black/20 p-3 text-sm text-dim">{msg}</div> : null}

        {!authed ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="1) Bootstrap (1º admin)">
              <div className="grid gap-3">
                <Field label="Bootstrap code" value={bootstrapCode} onChange={(e) => setBootstrapCode(e.target.value)} placeholder="HSP_BOOTSTRAP_CODE" />
                <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@..." />
                <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mín. 8 chars" />
                <Button onClick={() => doBootstrap().catch((e) => setMsg("Erro: " + e.message))}>Criar admin</Button>
              </div>
              <div className="mt-3 text-xs text-mute">Use apenas uma vez. Depois o bootstrap é bloqueado.</div>
            </Card>

            <Card title="2) Habilitar 2FA (Google Authenticator)">
              <div className="grid gap-3">
                <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button variant="secondary" onClick={() => totpStart().catch((e) => setMsg("Erro: " + e.message))}>Gerar QR</Button>
                {qr ? (
                  <div className="rounded-xl border border-border bg-black/20 p-3">
                    <div className="text-xs font-bold text-dim">QR Code</div>
                    <img alt="QR 2FA" className="mt-2 w-full rounded-lg" src={qr} />
                  </div>
                ) : null}
                <Field label="Código 2FA" value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="6 dígitos" />
                <Button onClick={() => totpEnable().catch((e) => setMsg("Erro: " + e.message))}>Ativar 2FA</Button>
              </div>
            </Card>

            <Card title="3) Login (2FA obrigatório)">
              <div className="grid gap-3">
                <Field label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                <Field label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Field label="TOTP" value={totp} onChange={(e) => setTotp(e.target.value)} placeholder="6 dígitos" />
                <Button onClick={() => doLogin().catch((e) => setMsg("Erro: " + e.message))}>Entrar</Button>
              </div>
              <div className="mt-3 text-xs text-mute">Sem 2FA não entra.</div>
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card
              title="Usuários"
              right={
                <div className="text-xs text-dim">
                  Total: <span className="font-mono">{users.length}</span>
                </div>
              }
            >
              <div className="grid gap-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Field label="Email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="cliente@..." />
                  <Field label="Senha" type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="mín. 8" />
                  <label className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-dim">Role</span>
                    <select
                      className="rounded-xl border border-border bg-black/20 px-3 py-2 text-sm text-text outline-none focus:border-white/25"
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value === "admin" ? "admin" : "user")}
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </label>
                </div>
                <Button onClick={() => createUser().catch((e) => setMsg("Erro: " + e.message))}>Criar usuário</Button>
                <div className="mt-2 max-h-[320px] overflow-auto rounded-xl border border-border bg-black/10">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-black/40 text-xs text-dim">
                      <tr>
                        <th className="p-2">id</th>
                        <th className="p-2">email</th>
                        <th className="p-2">role</th>
                        <th className="p-2">2FA</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id} className="border-t border-border/60">
                          <td className="p-2 font-mono text-xs">{u.id}</td>
                          <td className="p-2">{u.email}</td>
                          <td className="p-2 font-mono text-xs">{u.role}</td>
                          <td className="p-2 font-mono text-xs">{u.totp_enabled ? "OK" : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </Card>

            <Card
              title="Tenants (clientes)"
              right={
                <div className="text-xs text-dim">
                  Total: <span className="font-mono">{tenants.length}</span>
                </div>
              }
            >
              <div className="grid gap-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                  <Field label="Nome" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} placeholder="Cliente X" />
                  <Field label="Plano" value={newTenantPlan} onChange={(e) => setNewTenantPlan(e.target.value)} placeholder="starter/pro" />
                  <div className="flex items-end">
                    <Button onClick={() => createTenant().catch((e) => setMsg("Erro: " + e.message))} className="w-full">Criar tenant</Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <Field label="Grant: userId" value={grantUserId} onChange={(e) => setGrantUserId(e.target.value)} placeholder="usr_..." />
                  <Field label="Grant: tenantId" value={grantTenantId} onChange={(e) => setGrantTenantId(e.target.value)} placeholder="tnt_..." />
                </div>
                <Button variant="secondary" onClick={() => doGrant().catch((e) => setMsg("Erro: " + e.message))}>Vincular usuário → tenant</Button>

                <div className="mt-2 max-h-[320px] overflow-auto rounded-xl border border-border bg-black/10">
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-black/40 text-xs text-dim">
                      <tr>
                        <th className="p-2">id</th>
                        <th className="p-2">nome</th>
                        <th className="p-2">plano</th>
                        <th className="p-2">status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenants.map((t) => (
                        <tr key={t.id} className="border-t border-border/60">
                          <td className="p-2 font-mono text-xs">{t.id}</td>
                          <td className="p-2">{t.name}</td>
                          <td className="p-2 font-mono text-xs">{t.plan}</td>
                          <td className="p-2 font-mono text-xs">{t.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-mute">
                  Compliance: não é recomendação financeira. Sem garantia de lucro. Use limites de risco e trilha de auditoria.
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}


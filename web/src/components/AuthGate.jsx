import React, { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api.js";
import Button from "./Button.jsx";
import Card from "./Card.jsx";

const TOKEN_KEY = "hsp_token";
const SESSION_KEY = "hsp_web_session_v2";

function emitTokenChanged() {
  window.dispatchEvent(new Event("hsp-token-changed"));
}

function inputClassName() {
  return "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25";
}

export default function AuthGate({ children }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [mode, setMode] = useState("none");
  const [cfg, setCfg] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("login");

  const [tokenInput, setTokenInput] = useState(() => localStorage.getItem(TOKEN_KEY) || "local-dev");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [requires2faSetup, setRequires2faSetup] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [setupCode, setSetupCode] = useState("");

  const [fullName, setFullName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regPassword2, setRegPassword2] = useState("");
  const [regPlan, setRegPlan] = useState("starter");
  const [regCycle, setRegCycle] = useState("monthly");
  const [objective, setObjective] = useState("");
  const [planCatalog, setPlanCatalog] = useState([]);

  useEffect(() => {
    let alive = true;
    const init = async () => {
      setLoading(true);
      setMsg("");
      try {
        const conf = await apiGet("/api/auth/config");
        if (!alive) return;
        setCfg(conf);
        setMode(String(conf?.mode || "none"));
        if (String(conf?.mode || "none") === "none") {
          setAuthed(true);
          sessionStorage.removeItem(SESSION_KEY);
          setLoading(false);
          return;
        }
        if (String(conf?.mode || "none") === "cloud") {
          setTab("login");
          const plans = await apiGet("/api/auth/plans").catch(() => ({ plans: [] }));
          if (alive) {
            setPlanCatalog(Array.isArray(plans?.plans) ? plans.plans : []);
          }
        }
        const hasSession = sessionStorage.getItem(SESSION_KEY) === "1";
        const token = String(localStorage.getItem(TOKEN_KEY) || "");
        if (hasSession && token) {
          const verify = await apiGet("/api/auth/verify", { token }).catch(() => ({ ok: false }));
          if (!alive) return;
          if (verify?.ok) {
            setAuthed(true);
            setLoading(false);
            return;
          }
        }
        setAuthed(false);
        sessionStorage.removeItem(SESSION_KEY);
      } catch {
        if (!alive) return;
        setMsg("Não foi possível validar autenticação agora. Tente novamente.");
      } finally {
        if (alive) setLoading(false);
      }
    };
    init().catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const title = useMemo(() => {
    if (mode === "cloud") return "Acesso do Painel Operacional";
    if (mode === "token") return "Token do Painel Operacional";
    return "Painel Operacional";
  }, [mode]);

  const help = useMemo(() => {
    if (mode === "cloud") {
      return "Use sua conta aprovada pelo administrador. Se for o primeiro acesso, envie uma solicitação de cadastro.";
    }
    if (mode === "token") {
      return "Informe o token operacional configurado no servidor.";
    }
    return "";
  }, [mode]);

  const submit = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (mode === "token") {
        const token = String(tokenInput || "").trim();
        if (!token) throw new Error("Informe o token para continuar.");
        const result = await apiPost("/api/auth/login", { body: { token } });
        if (!result?.ok) throw new Error("Token inválido.");
        localStorage.setItem(TOKEN_KEY, token);
      } else if (mode === "cloud") {
        const body = {
          email: String(email || "").trim(),
          password: String(password || ""),
          totp: String(totp || "").trim()
        };
        if (!body.email || !body.password || !body.totp) {
          throw new Error("Preencha e-mail, senha e código 2FA.");
        }
        const result = await apiPost("/api/auth/login", { body });
        const token = String(result?.token || "").trim();
        if (!token) throw new Error("Falha ao receber sessão do servidor.");
        localStorage.setItem(TOKEN_KEY, token);
      }
      sessionStorage.setItem(SESSION_KEY, "1");
      emitTokenChanged();
      setAuthed(true);
    } catch (error) {
      const code = String(error?.code || "");
      if (code === "TOTP_REQUIRED" || code === "TOTP_SETUP_REQUIRED") {
        setRequires2faSetup(true);
      }
      setMsg(error instanceof Error ? error.message : "Não foi possível autenticar.");
    } finally {
      setBusy(false);
    }
  };

  const submitRegister = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (String(fullName).trim().length < 3) throw new Error("Informe seu nome completo.");
      if (!String(regEmail).trim().includes("@")) throw new Error("Informe um e-mail válido.");
      if (String(regPassword).length < 8) throw new Error("A senha deve ter no mínimo 8 caracteres.");
      if (regPassword !== regPassword2) throw new Error("As senhas não conferem.");
      await apiPost("/api/auth/register-request", {
        body: {
          fullName,
          email: regEmail,
          password: regPassword,
          plan: regPlan,
          billingCycle: regCycle,
          objective
        }
      });
      setTab("login");
      setEmail(regEmail);
      setPassword("");
      setTotp("");
      setMsg("Cadastro enviado com sucesso. Aguarde aprovação no painel administrativo.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Falha ao enviar cadastro.");
    } finally {
      setBusy(false);
    }
  };

  const start2faSetup = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (!String(email).trim() || !String(password).trim()) {
        throw new Error("Informe e-mail e senha para gerar o QR do 2FA.");
      }
      const response = await apiPost("/api/auth/totp/setup-start", {
        body: { email, password }
      });
      const qr = String(response?.qrDataUrl || "");
      if (!qr) throw new Error("Não foi possível gerar o QR do 2FA.");
      setQrDataUrl(qr);
      setRequires2faSetup(true);
      setMsg("QR gerado. Escaneie no Google Authenticator e informe o código de 6 dígitos.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Falha ao iniciar configuração de 2FA.");
    } finally {
      setBusy(false);
    }
  };

  const enable2fa = async () => {
    setBusy(true);
    setMsg("");
    try {
      if (!String(setupCode).trim() || String(setupCode).trim().length < 6) {
        throw new Error("Informe o código de 6 dígitos do autenticador.");
      }
      await apiPost("/api/auth/totp/enable", {
        body: { email, password, code: setupCode }
      });
      setRequires2faSetup(false);
      setQrDataUrl("");
      setSetupCode("");
      setMsg("2FA ativado. Agora faça login com e-mail, senha e TOTP.");
    } catch (error) {
      setMsg(error instanceof Error ? error.message : "Falha ao ativar 2FA.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return null;
  if (authed) return children;
  if (mode === "none") return children;

  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[1280px] items-center justify-center p-4">
      <Card title={title} className="w-full max-w-[640px]">
        <div className="text-sm text-white/70">{help}</div>
        {cfg?.requires_2fa ? (
          <div className="mt-2 rounded-xl border border-amber-400/30 bg-amber-300/10 p-2 text-xs text-amber-200">
            Segurança ativa: painel operacional com autenticação e 2FA.
          </div>
        ) : null}

        {mode === "cloud" ? (
          <div className="mt-3 flex gap-2">
            <Button variant={tab === "login" ? "primary" : "secondary"} onClick={() => setTab("login")}>
              Entrar
            </Button>
            <Button variant={tab === "register" ? "primary" : "secondary"} onClick={() => setTab("register")}>
              Solicitar cadastro
            </Button>
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-2">
          {mode === "cloud" && tab === "register" ? (
            <>
              <div>
                <label className="text-xs text-white/60">Nome completo</label>
                <input className={inputClassName()} value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-white/60">E-mail</label>
                  <input className={inputClassName()} value={regEmail} onChange={(e) => setRegEmail(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-white/60">Objetivo</label>
                  <input className={inputClassName()} value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex: operar BTC e ETH com risco controlado" />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-white/60">Senha</label>
                  <input type="password" className={inputClassName()} value={regPassword} onChange={(e) => setRegPassword(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-white/60">Confirmar senha</label>
                  <input type="password" className={inputClassName()} value={regPassword2} onChange={(e) => setRegPassword2(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <label className="text-xs text-white/60">Plano</label>
                  <select className={inputClassName()} value={regPlan} onChange={(e) => setRegPlan(e.target.value)}>
                    {(planCatalog.length ? planCatalog : [{ plan: "starter" }, { plan: "pro" }, { plan: "premium" }]).map((entry) => (
                      <option key={entry.plan} value={entry.plan}>
                        {String(entry.plan || "").toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-white/60">Ciclo da licença</label>
                  <select className={inputClassName()} value={regCycle} onChange={(e) => setRegCycle(e.target.value)}>
                    <option value="monthly">Mensal</option>
                    <option value="quarterly">Trimestral</option>
                    <option value="semiannual">Semestral</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
              </div>
            </>
          ) : mode === "cloud" ? (
            <>
              <div>
                <label className="text-xs text-white/60">E-mail</label>
                <input
                  className={inputClassName()}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Senha</label>
                <input
                  className={inputClassName()}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="text-xs text-white/60">Código 2FA (Google Authenticator)</label>
                <input
                  className={inputClassName()}
                  value={totp}
                  onChange={(e) => setTotp(e.target.value)}
                  inputMode="numeric"
                  placeholder="6 dígitos"
                />
              </div>
              {requires2faSetup ? (
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs text-white/70">Configuração de 2FA</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => start2faSetup().catch(() => {})} disabled={busy}>
                      Gerar QR 2FA
                    </Button>
                  </div>
                  {qrDataUrl ? (
                    <div className="mt-3">
                      <img src={qrDataUrl} alt="QR 2FA" className="h-44 w-44 rounded-lg border border-white/10 bg-white p-2" />
                    </div>
                  ) : null}
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                    <input
                      className={inputClassName()}
                      value={setupCode}
                      onChange={(e) => setSetupCode(e.target.value)}
                      placeholder="Código de 6 dígitos"
                      inputMode="numeric"
                    />
                    <Button onClick={() => enable2fa().catch(() => {})} disabled={busy}>
                      Ativar 2FA
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-white/60">
                  Não ativou 2FA ainda?{" "}
                  <button
                    type="button"
                    className="text-amber-300 underline"
                    onClick={() => {
                      setRequires2faSetup(true);
                      setMsg("Ative o 2FA para concluir seu primeiro acesso.");
                    }}
                  >
                    Configurar agora
                  </button>
                  .
                </div>
              )}
            </>
          ) : (
            <div>
              <label className="text-xs text-white/60">Token</label>
              <input
                className={inputClassName()}
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                autoComplete="off"
              />
            </div>
          )}
        </div>

        {msg ? <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 p-2 text-sm">{msg}</div> : null}
        <div className="mt-3">
          {mode === "cloud" && tab === "register" ? (
            <Button variant="primary" disabled={busy} onClick={() => submitRegister().catch(() => {})}>
              {busy ? "Enviando..." : "Enviar para aprovação"}
            </Button>
          ) : (
            <Button variant="primary" disabled={busy} onClick={() => submit().catch(() => {})}>
              {busy ? "Validando..." : "Entrar"}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

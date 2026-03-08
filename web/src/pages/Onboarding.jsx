import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet, apiPost } from "../lib/api.js";

const STEPS = [
  { key: "exchange", title: "1) Conectar exchange", desc: "Informe API Key e Secret da Binance para leitura/operação." },
  { key: "risk", title: "2) Configurar risco", desc: "Defina limites diários para evitar operações fora de controle." },
  { key: "symbols", title: "3) Selecionar moedas", desc: "Escolha os ativos monitorados pelo bot." },
  { key: "assist", title: "4) Ativar inteligência", desc: "Opcional: notícias e alertas Telegram." },
  { key: "start", title: "5) Iniciar em modo piloto", desc: "Rode em dry-run/testnet antes de qualquer LIVE." }
];

function doneTone(done) {
  return done ? "good" : "warn";
}

export default function Onboarding({ token, setToken, onGoDashboard }) {
  const [status, setStatus] = useState(null);
  const [step, setStep] = useState(0);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [envForm, setEnvForm] = useState({
    API_KEY: "",
    API_SECRET: "",
    NEWS_API_KEY: "",
    TELEGRAM_API_KEY: "",
    TELEGRAM_CHAT_ID: ""
  });
  const [riskForm, setRiskForm] = useState({
    risk_max_daily_buy_quote_usdt: 50,
    risk_max_daily_loss_usdt: 5,
    risk_max_orders_per_day: 12,
    risk_max_exposure_quote_usdt_per_symbol: 25,
    max_open_positions: 3
  });
  const [symbolsCsv, setSymbolsCsv] = useState("BTCUSDT,ETHUSDT,BNBUSDT");

  const refresh = async () => {
    const r = await apiGet("/api/config/status", { token });
    setStatus(r);
    const s = r.settings || {};
    setRiskForm((prev) => ({
      ...prev,
      risk_max_daily_buy_quote_usdt: Number(s.risk_max_daily_buy_quote_usdt ?? prev.risk_max_daily_buy_quote_usdt),
      risk_max_daily_loss_usdt: Number(s.risk_max_daily_loss_usdt ?? prev.risk_max_daily_loss_usdt),
      risk_max_orders_per_day: Number(s.risk_max_orders_per_day ?? prev.risk_max_orders_per_day),
      risk_max_exposure_quote_usdt_per_symbol: Number(
        s.risk_max_exposure_quote_usdt_per_symbol ?? prev.risk_max_exposure_quote_usdt_per_symbol
      ),
      max_open_positions: Number(s.max_open_positions ?? prev.max_open_positions)
    }));
    if (Array.isArray(s.moedas_monitoradas) && s.moedas_monitoradas.length) {
      setSymbolsCsv(s.moedas_monitoradas.join(","));
    }
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [token]);

  const checks = useMemo(() => {
    const env = status?.env_present || {};
    const st = status?.settings || {};
    const hasExchange = Boolean(env.API_KEY && env.API_SECRET);
    const hasRisk =
      Number(st.risk_max_daily_buy_quote_usdt || 0) > 0 &&
      Number(st.risk_max_daily_loss_usdt || 0) > 0 &&
      Number(st.max_open_positions || 0) > 0;
    const hasSymbols = Array.isArray(st.moedas_monitoradas) && st.moedas_monitoradas.length > 0;
    const hasAssist = Boolean(env.NEWS_API_KEY || (env.TELEGRAM_API_KEY && env.TELEGRAM_CHAT_ID));
    return {
      exchange: hasExchange,
      risk: hasRisk,
      symbols: hasSymbols,
      assist: hasAssist,
      start: false
    };
  }, [status]);

  const mergeAndSaveSettings = async (patch) => {
    const current = status?.settings || {};
    await apiPost("/api/config/save_settings", { token, body: { ...current, ...patch } });
    await refresh();
  };

  const saveExchange = async () => {
    setBusy(true);
    setMsg("");
    try {
      const body = {};
      if (String(envForm.API_KEY || "").trim()) body.API_KEY = String(envForm.API_KEY).trim();
      if (String(envForm.API_SECRET || "").trim()) body.API_SECRET = String(envForm.API_SECRET).trim();
      if (!Object.keys(body).length) throw new Error("Preencha API Key e API Secret.");
      await apiPost("/api/config/save_env", { token, body });
      setMsg("✔ Binance conectada. Chaves salvas.");
      setStep(1);
      setEnvForm((prev) => ({ ...prev, API_KEY: "", API_SECRET: "" }));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const saveRisk = async () => {
    setBusy(true);
    setMsg("");
    try {
      await mergeAndSaveSettings({
        risk_max_daily_buy_quote_usdt: Number(riskForm.risk_max_daily_buy_quote_usdt),
        risk_max_daily_loss_usdt: Number(riskForm.risk_max_daily_loss_usdt),
        risk_max_orders_per_day: Number(riskForm.risk_max_orders_per_day),
        risk_max_exposure_quote_usdt_per_symbol: Number(riskForm.risk_max_exposure_quote_usdt_per_symbol),
        max_open_positions: Number(riskForm.max_open_positions),
        testnet: true
      });
      setMsg("✔ Limites de risco salvos com sucesso.");
      setStep(2);
    } finally {
      setBusy(false);
    }
  };

  const saveSymbols = async () => {
    setBusy(true);
    setMsg("");
    try {
      const moedas = String(symbolsCsv || "")
        .split(",")
        .map((x) => x.trim().toUpperCase())
        .filter(Boolean);
      if (!moedas.length) throw new Error("Informe ao menos uma moeda.");
      await mergeAndSaveSettings({ moedas_monitoradas: moedas });
      setMsg("✔ Moedas monitoradas atualizadas.");
      setStep(3);
    } finally {
      setBusy(false);
    }
  };

  const saveAssist = async () => {
    setBusy(true);
    setMsg("");
    try {
      const body = {};
      if (String(envForm.NEWS_API_KEY || "").trim()) body.NEWS_API_KEY = String(envForm.NEWS_API_KEY).trim();
      if (String(envForm.TELEGRAM_API_KEY || "").trim()) body.TELEGRAM_API_KEY = String(envForm.TELEGRAM_API_KEY).trim();
      if (String(envForm.TELEGRAM_CHAT_ID || "").trim()) body.TELEGRAM_CHAT_ID = String(envForm.TELEGRAM_CHAT_ID).trim();
      if (Object.keys(body).length) {
        await apiPost("/api/config/save_env", { token, body });
      }
      setMsg("✔ Inteligência auxiliar configurada.");
      setStep(4);
      setEnvForm((prev) => ({ ...prev, NEWS_API_KEY: "", TELEGRAM_API_KEY: "", TELEGRAM_CHAT_ID: "" }));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const startPilot = async () => {
    setBusy(true);
    setMsg("");
    try {
      await apiPost("/api/bot/start", { token, query: { dry_run: true, once: false } });
      setMsg("✔ Bot iniciado em modo piloto (dry-run).");
      localStorage.setItem("hsp_onboarding_done", "1");
      if (onGoDashboard) onGoDashboard();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="Assistente de Primeiro Uso"
        right={<Badge tone="warn">Fluxo guiado</Badge>}
      >
        <div className="text-sm text-white/70">
          Use este passo a passo para sair do zero e operar com segurança. O fluxo já aplica padrão piloto (testnet/dry-run).
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-5">
          {STEPS.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => setStep(idx)}
              className={[
                "rounded-xl border px-3 py-2 text-left text-xs",
                step === idx ? "border-accent/60 bg-accent/10" : "border-white/10 bg-black/10 hover:border-white/20"
              ].join(" ")}
            >
              <div className="font-extrabold">{s.title}</div>
              <div className="mt-1 text-white/60">{s.desc}</div>
              <div className="mt-2">
                <Badge tone={doneTone(checks[s.key])}>{checks[s.key] ? "concluído" : "pendente"}</Badge>
              </div>
            </button>
          ))}
        </div>
        {msg ? <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">{msg}</div> : null}
      </Card>

      {step === 0 ? (
        <Card title="Passo 1 — Conectar Binance">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            <div>
              <div className="text-xs text-white/60">API Key</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="password" value={envForm.API_KEY} onChange={(e) => setEnvForm((p) => ({ ...p, API_KEY: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-white/60">API Secret</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="password" value={envForm.API_SECRET} onChange={(e) => setEnvForm((p) => ({ ...p, API_SECRET: e.target.value }))} />
            </div>
          </div>
          <div className="mt-2 text-xs text-white/60">Recomendação: habilite apenas Spot Trading e nunca habilite saque na chave API.</div>
          <div className="mt-3">
            <Button variant="primary" onClick={() => saveExchange().catch((e) => setMsg("Erro: " + e.message))} disabled={busy}>
              {busy ? "Salvando..." : "Salvar e continuar"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card title="Passo 2 — Configurar Risco">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <div className="text-xs text-white/60">Limite de compras/dia (USDT)</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="number" value={riskForm.risk_max_daily_buy_quote_usdt} onChange={(e) => setRiskForm((p) => ({ ...p, risk_max_daily_buy_quote_usdt: Number(e.target.value) }))} />
            </div>
            <div>
              <div className="text-xs text-white/60">Perda máxima/dia (USDT)</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="number" value={riskForm.risk_max_daily_loss_usdt} onChange={(e) => setRiskForm((p) => ({ ...p, risk_max_daily_loss_usdt: Number(e.target.value) }))} />
            </div>
            <div>
              <div className="text-xs text-white/60">Máximo de posições abertas</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="number" value={riskForm.max_open_positions} onChange={(e) => setRiskForm((p) => ({ ...p, max_open_positions: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="mt-2 text-xs text-white/60">Este passo também mantém testnet ligado para modo piloto.</div>
          <div className="mt-3">
            <Button variant="primary" onClick={() => saveRisk().catch((e) => setMsg("Erro: " + e.message))} disabled={busy}>
              {busy ? "Salvando..." : "Salvar risco e continuar"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card title="Passo 3 — Escolher Moedas">
          <div className="text-xs text-white/60">Informe as moedas separadas por vírgula (ex: BTCUSDT,ETHUSDT,BNBUSDT).</div>
          <input className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" value={symbolsCsv} onChange={(e) => setSymbolsCsv(e.target.value)} />
          <div className="mt-3">
            <Button variant="primary" onClick={() => saveSymbols().catch((e) => setMsg("Erro: " + e.message))} disabled={busy}>
              {busy ? "Salvando..." : "Salvar moedas e continuar"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 3 ? (
        <Card title="Passo 4 — Ativar Inteligência (Opcional)">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            <div>
              <div className="text-xs text-white/60">News API Key</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="password" value={envForm.NEWS_API_KEY} onChange={(e) => setEnvForm((p) => ({ ...p, NEWS_API_KEY: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-white/60">Telegram Bot Token</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" type="password" value={envForm.TELEGRAM_API_KEY} onChange={(e) => setEnvForm((p) => ({ ...p, TELEGRAM_API_KEY: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-white/60">Telegram Chat ID</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" value={envForm.TELEGRAM_CHAT_ID} onChange={(e) => setEnvForm((p) => ({ ...p, TELEGRAM_CHAT_ID: e.target.value }))} />
            </div>
          </div>
          <div className="mt-3">
            <Button variant="primary" onClick={() => saveAssist().catch((e) => setMsg("Erro: " + e.message))} disabled={busy}>
              {busy ? "Salvando..." : "Salvar inteligência e continuar"}
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 4 ? (
        <Card title="Passo 5 — Iniciar Bot (Piloto)">
          <div className="text-sm text-white/70">
            Agora inicie em <span className="font-semibold">dry-run</span>. Você verá decisões e auditoria sem operar dinheiro real.
          </div>
          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <div className="text-xs text-white/60">Token de controle do painel</div>
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm" value={token} onChange={(e) => setToken(e.target.value)} />
            </div>
            <Button variant="secondary" onClick={() => localStorage.setItem("hsp_onboarding_done", "1")}>
              Marcar como concluído
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => startPilot().catch((e) => setMsg("Erro: " + e.message))} disabled={busy}>
              {busy ? "Iniciando..." : "Iniciar em dry-run"}
            </Button>
            <Button variant="secondary" onClick={() => onGoDashboard?.()}>
              Ir para dashboard
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}



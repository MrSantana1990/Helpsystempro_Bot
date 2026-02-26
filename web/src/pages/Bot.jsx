import React, { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet, apiPost } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";

function licenseStatusPt(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "ativa";
  if (s === "expired") return "expirada";
  if (s === "invalid") return "inválida";
  if (s === "missing") return "ausente";
  return status || "-";
}

export default function Bot({ token, setToken }) {
  const [status, setStatus] = useState(null);
  const [reg, setReg] = useState(null);
  const [risk, setRisk] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [lic, setLic] = useState(null);
  const [comp, setComp] = useState(null);
  const [term, setTerm] = useState(null);
  const [showTerm, setShowTerm] = useState(false);
  const [termOk, setTermOk] = useState(false);
  const [ksReason, setKsReason] = useState("");
  const [msg, setMsg] = useState("");
  const [dryRun, setDryRun] = useState(true);
  const [approveMode, setApproveMode] = useState("24h"); // 24h | 7d | forever

  const refresh = async () => {
    const [r, rr, rk, rc, rl, rcomp] = await Promise.all([
      apiGet("/api/bot/status", { token }),
      apiGet("/api/symbols/registry", { token }).catch(() => null),
      apiGet("/api/risk/daily", { token }).catch(() => null),
      apiGet("/api/config/status", { token }).catch(() => null),
      apiGet("/api/license/status", { token }).catch(() => null),
      apiGet("/api/compliance/status", { token }).catch(() => null)
    ]);
    setStatus(r);
    setReg(rr);
    setRisk(rk);
    setCfg(rc);
    setLic(rl);
    setComp(rcomp);
    return r;
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  const botOn = !!status?.running;
  const killOn = !!status?.kill_switch?.enabled;

  const play = async () => {
    setMsg("");
    if (killOn) {
      setMsg("KILL SWITCH ativo: desative antes de iniciar.");
      return;
    }
    const testnet = cfg?.settings?.testnet !== false;
    const liveIntent = !dryRun && !testnet;

    if (!dryRun) {
      const ok = window.confirm("ATENÇÃO: você está iniciando o bot para enviar ordens (não é simulação). Use testnet primeiro. Deseja continuar?");
      if (!ok) return;
    }

    if (liveIntent) {
      const liveEnabled = !!(cfg?.flags?.live_trading_enabled || cfg?.flags?.live_mode);
      if (!liveEnabled) {
        setMsg("LIVE bloqueado: habilite HSP_LIVE_TRADING=1 e reinicie o backend.");
        return;
      }
      if (!lic?.valid) {
        setMsg("LIVE bloqueado: licença inválida/expirada. Veja Saúde → Licença.");
        return;
      }
      if (!comp?.accepted) {
        try {
          const t = await apiGet("/api/compliance/term", { token });
          setTerm(t);
        } catch {
          setTerm({ text: "Termo indisponível. Consulte docs/TERMO_RESPONSABILIDADE.md", version: "1.0" });
        }
        setTermOk(false);
        setShowTerm(true);
        setMsg("Antes do LIVE, aceite o termo de responsabilidade.");
        return;
      }
      const t = window.prompt('CONFIRMAÇÃO EXTRA (LIVE): digite "LIVE" para continuar.');
      if (String(t || "").trim().toUpperCase() !== "LIVE") return;
    }

    await apiPost("/api/bot/start", { token, query: { dry_run: dryRun, once: false } });
    setMsg(dryRun ? "Play OK (dry-run / análise)." : "Play OK (ordens habilitadas).");
    await refresh();
  };

  const stop = async () => {
    setMsg("");
    await apiPost("/api/bot/stop", { token });
    setMsg("Stop OK.");
    await refresh();
  };

  const killSwitchSet = async (enabled) => {
    setMsg("");
    const body = enabled ? { enabled: true, reason: ksReason || "manual" } : { enabled: false };
    await apiPost("/api/bot/kill_switch", { token, body });
    setMsg(enabled ? "KILL SWITCH ativado." : "KILL SWITCH desativado.");
    await refresh();
  };

  const decide = async (symbol, decision) => {
    setMsg("");
    const body = { symbol, decision };
    if (decision === "approve") {
      if (approveMode === "forever") body.permanent = true;
      else body.ttl_hours = approveMode === "7d" ? 168 : 24;
    }
    await apiPost("/api/symbols/decide", { token, body });
    setMsg(`${symbol}: ${decision.toUpperCase()} OK.`);
    await refresh();
  };

  const approvedItems = reg?.approved || [];
  const fmtExpiry = (it) => {
    if (!it || typeof it !== "object") return "";
    if (it.permanent) return "permanente";
    if (it.expires_at_utc) return "até " + String(it.expires_at_utc).replace("T", " ").replace("Z", " UTC");
    return "";
  };

  return (
    <div className="flex flex-col gap-3">
      {showTerm ? (
        <div className="rounded-xl2 border border-accent/25 bg-accent/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-lg font-extrabold">Termo de responsabilidade (obrigatório para LIVE)</div>
            <Button variant="secondary" onClick={() => setShowTerm(false)}>
              Fechar
            </Button>
          </div>
          <div className="mt-2 text-sm text-white/70">
            Leia com atenção. Para operar em conta real (LIVE), você precisa aceitar este termo.
          </div>
          <textarea
            className="mt-3 h-[260px] w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs outline-none focus:border-white/25"
            readOnly
            value={String(term?.text || "").trim()}
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-white/80">
            <input type="checkbox" checked={termOk} onChange={(e) => setTermOk(e.target.checked)} />
            Li e aceito o termo acima.
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                (async () => {
                  if (!termOk) throw new Error("Marque a caixa de aceite para continuar.");
                  await apiPost("/api/compliance/accept", { token, body: { version: term?.version || "1.0" } });
                  setShowTerm(false);
                  setMsg("Termo aceito. Agora clique em Play novamente para LIVE.");
                  await refresh();
                })().catch((e) => setMsg("Erro: " + e.message))
              }
            >
              Aceitar termo
            </Button>
            <div className="text-xs text-white/60">Isso não é recomendação financeira e não há garantia de lucro.</div>
          </div>
        </div>
      ) : null}

      <Card title="Bot (Play/Stop)">
        <div className="rounded-xl border border-accent/25 bg-accent/10 p-3 text-sm">
          Segurança: use <b>dry-run</b> para simular/analisar. Operação real envolve risco e não há garantia de ganhos.
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Token</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="local-dev"
            />
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/70">
            <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
            Dry-run (simular)
          </label>
          <Button onClick={() => play().catch((e) => setMsg("Erro: " + e.message))} disabled={botOn}>
            Play
          </Button>
          <Button variant="secondary" onClick={() => stop().catch((e) => setMsg("Erro: " + e.message))} disabled={!botOn}>
            Parar
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge tone={botOn ? "good" : "neutral"}>status: {botOn ? "rodando" : "parado"}</Badge>
          <Badge>pid: {status?.pid ?? "-"}</Badge>
          <Badge className="font-mono">args: {status?.state?.args ? String(status.state.args) : "-"}</Badge>
          <Badge tone={killOn ? "bad" : "neutral"}>trava: {killOn ? "ATIVA" : "INATIVA"}</Badge>
          <Badge tone={cfg?.settings?.testnet === false ? "warn" : "neutral"}>ambiente: {cfg?.settings?.testnet === false ? "REAL" : "TESTNET"}</Badge>
          <Badge tone={lic?.valid ? "good" : "warn"}>licença: {lic?.valid ? "ATIVA" : licenseStatusPt(lic?.status)}</Badge>
          <Badge tone={comp?.accepted ? "good" : "warn"}>termo: {comp?.accepted ? "ACEITO" : "pendente"}</Badge>
        </div>
        {msg ? <div className="mt-3 text-sm text-white/70">{msg}</div> : null}
      </Card>

      <Card
        title="Risco (limites + kill switch)"
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => refresh().catch(() => {})}>
              Recarregar
            </Button>
          </div>
        }
      >
        <div className="text-sm text-white/70">
          Local-first: a API roda em <b>localhost</b>. O kill switch bloqueia <b>novas compras</b> quando ativado (manual ou por limites).
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge>buy hoje: {risk?.stats ? fmtNumber(risk.stats.buy_quote_usdt, 2) : "-"} USDT</Badge>
          <Badge>PnL hoje (realizado): {risk?.stats ? fmtNumber(risk.stats.realized_pnl_usdt, 2) : "-"} USDT</Badge>
          <Badge>lim buy: {risk?.limits ? fmtNumber(risk.limits.risk_max_daily_buy_quote_usdt, 2) : "-"} USDT</Badge>
          <Badge>lim loss: {risk?.limits ? fmtNumber(risk.limits.risk_max_daily_loss_usdt, 2) : "-"} USDT</Badge>
          <Badge tone={risk?.ok_to_buy === false ? "warn" : "neutral"}>ok: {risk?.ok_to_buy === false ? "NÃO" : "SIM"}</Badge>
        </div>

        {risk?.reason && risk.reason !== "OK" ? (
          <div className="mt-3 rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm">{risk.reason}</div>
        ) : null}

        <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Motivo (opcional)</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-white/25"
              value={ksReason}
              onChange={(e) => setKsReason(e.target.value)}
              placeholder="Ex.: pausa para ajuste de parâmetros"
            />
          </div>
          <Button onClick={() => killSwitchSet(true).catch((e) => setMsg("Erro: " + e.message))} disabled={killOn}>
            Ativar kill
          </Button>
          <Button
            variant="secondary"
            onClick={() => killSwitchSet(false).catch((e) => setMsg("Erro: " + e.message))}
            disabled={!killOn}
          >
            Desativar kill
          </Button>
        </div>

        {killOn ? (
          <div className="mt-3 text-xs text-white/60">
            Motivo: <span className="font-mono">{String(status?.kill_switch?.reason || "-")}</span>
          </div>
        ) : null}
      </Card>

      <Card
        title="Aprovações (novas moedas)"
        right={
          <div className="flex items-center gap-2">
            <Badge>autorizadas: {(reg?.effective_symbols || []).length}</Badge>
            <Badge tone={(reg?.pending || []).length ? "warn" : "neutral"}>pendentes: {(reg?.pending || []).length}</Badge>
            <select
              className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs outline-none focus:border-white/25"
              value={approveMode}
              onChange={(e) => setApproveMode(e.target.value)}
              title="Prazo da aprovação"
            >
              <option value="24h">Aprovar 24h</option>
              <option value="7d">Aprovar 7 dias</option>
              <option value="forever">Aprovar sempre</option>
            </select>
            <Button variant="secondary" onClick={() => refresh().catch(() => {})}>
              Recarregar
            </Button>
          </div>
        }
      >
        <div className="text-sm text-white/70">
          Regra: <b>moedas selecionadas por você</b> (Configurações → moedas_monitoradas) podem operar automaticamente.{" "}
          <b>Moedas novas</b> detectadas pelo bot entram aqui e precisam do seu OK.
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div>
            <div className="text-xs text-white/60">Auto (selecionadas por você)</div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3 text-sm">
              {(reg?.auto_symbols || []).length ? (
                <div className="flex flex-wrap gap-2">
                  {(reg.auto_symbols || []).slice(0, 30).map((s) => (
                    <Badge key={s} className="font-mono">
                      {s}
                    </Badge>
                  ))}
                </div>
              ) : (
                <div className="text-white/60">Nenhuma (configure moedas_monitoradas).</div>
              )}
            </div>

            <div className="mt-3 text-xs text-white/60">Aprovadas (novas)</div>
            <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3 text-sm">
              {approvedItems.length ? (
                <div className="flex flex-col gap-2">
                  {approvedItems.slice(0, 30).map((it) => (
                    <div key={it.symbol || String(it)} className="flex flex-wrap items-center justify-between gap-2">
                      <Badge tone="good" className="font-mono">
                        {it.symbol || String(it)}
                      </Badge>
                      <div className="text-xs text-white/60">{fmtExpiry(it) || ""}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-white/60">Nenhuma aprovada ainda.</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs text-white/60">Pendentes (precisam do seu OK)</div>
            {(reg?.pending || []).length ? (
              <div className="mt-2 max-h-[460px] overflow-auto rounded-xl border border-white/10">
                {(reg.pending || []).map((p) => (
                  <div key={p.symbol} className="border-b border-white/5 bg-black/5 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-extrabold">{p.symbol}</div>
                        <div className="text-xs text-white/60">{p.ts_utc || ""}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge tone="good">score: {fmtNumber(p.score, 3)}</Badge>
                        <Badge>conf.: {fmtNumber(p.confidence, 3)}</Badge>
                        <Button onClick={() => decide(p.symbol, "approve").catch((e) => setMsg("Erro: " + e.message))}>
                          Aprovar
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => decide(p.symbol, "reject").catch((e) => setMsg("Erro: " + e.message))}
                        >
                          Rejeitar
                        </Button>
                      </div>
                    </div>
                    {Array.isArray(p.why) && p.why.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                        {p.why.slice(0, 6).map((line, idx) => (
                          <li key={idx}>{String(line)}</li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-white/60">
                Nenhuma pendência agora. Quando o bot encontrar uma nova oportunidade fora da sua lista, ela aparece aqui.
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

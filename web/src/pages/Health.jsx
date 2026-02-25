import React, { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet, apiPost } from "../lib/api.js";

function Row({ k, v }) {
  return (
    <div className="grid grid-cols-[160px_1fr] gap-3 border-b border-white/5 py-2 text-sm">
      <div className="text-white/60">{k}</div>
      <div className="min-w-0 break-words font-mono text-xs text-white/80">{String(v ?? "-")}</div>
    </div>
  );
}

export default function Health({ token }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [licenseText, setLicenseText] = useState("");
  const [licenseMsg, setLicenseMsg] = useState("");
  const [term, setTerm] = useState(null);
  const [termErr, setTermErr] = useState("");

  const refresh = async () => {
    setErr("");
    const r = await apiGet("/api/ops/health", { token });
    setData(r);
    try {
      const t = await apiGet("/api/compliance/term", { token });
      setTerm(t);
      setTermErr("");
    } catch (e) {
      setTerm(null);
      setTermErr(e.message);
    }
  };

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  const lic = data?.license || null;
  const bot = data?.bot || null;
  const runtime = data?.runtime || null;

  const download = async (path, filename) => {
    const url = new URL(path, window.location.origin);
    const res = await fetch(url.toString(), {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json?.detail || res.statusText);
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card
        title="Saúde do Sistema"
        right={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2">
          <Badge>uptime: {data?.api?.uptime_s ?? "-"}s</Badge>
          <Badge tone={bot?.running ? "good" : "neutral"}>bot: {bot?.running ? "ON" : "OFF"}</Badge>
          <Badge tone={bot?.kill_switch?.enabled ? "bad" : "neutral"}>kill: {bot?.kill_switch?.enabled ? "ON" : "OFF"}</Badge>
          <Badge tone={lic?.valid ? "good" : "warn"}>
            licença: {lic?.valid ? "ATIVA" : (lic?.status || "N/A")}
          </Badge>
        </div>
        {err ? <div className="mt-3 text-sm text-red-200/80">Erro: {err}</div> : null}
      </Card>

      <Card title="Operação (runtime)">
        <Row k="last_cycle_start_utc" v={runtime?.last_cycle_start_utc} />
        <Row k="last_cycle_end_utc" v={runtime?.last_cycle_end_utc} />
        <Row k="last_cycle_duration_s" v={runtime?.last_cycle_duration_s} />
        <Row k="last_error_at_utc" v={runtime?.last_error_at_utc} />
        <Row k="last_error" v={runtime?.last_error} />
      </Card>

      <Card title="Risco (hoje / UTC)">
        <Row k="day_utc" v={data?.risk_daily?.day_utc} />
        <Row k="buy_quote_usdt" v={data?.risk_daily?.buy_quote_usdt} />
        <Row k="sell_quote_usdt" v={data?.risk_daily?.sell_quote_usdt} />
        <Row k="realized_pnl_usdt" v={data?.risk_daily?.realized_pnl_usdt} />
        <Row k="fees_usdt" v={data?.risk_daily?.fees_usdt} />
        <Row k="orders_count" v={data?.risk_daily?.orders_count} />
        <Row k="executions_count" v={data?.risk_daily?.executions_count} />
        <Row k="drawdown_usdt_est" v={data?.risk_daily?.drawdown_usdt_est} />
      </Card>

      <Card title="Licença (offline)">
        <div className="text-sm text-white/70">
          A licença é exigida apenas para <b>LIVE</b> (testnet=false + dry-run desligado).
        </div>
        <div className="mt-3">
          <Row k="status" v={lic?.status} />
          <Row k="valid" v={lic?.valid} />
          <Row k="plan" v={lic?.plan} />
          <Row k="expires_at_utc" v={lic?.expires_at_utc} />
          <Row k="reason" v={lic?.reason} />
          <Row k="machine_hash_local" v={lic?.machine_hash_local} />
          <Row k="path" v={lic?.path} />
        </div>

        <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
          <div className="text-sm font-bold">Instalar/atualizar licença</div>
          <div className="mt-1 text-xs text-white/60">
            Cole o JSON da licença assinada e clique em salvar. Isso não expõe a API publicamente (Local-first).
          </div>
          <textarea
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs outline-none focus:border-white/25"
            rows={6}
            value={licenseText}
            onChange={(e) => setLicenseText(e.target.value)}
            placeholder='{"plan":"Pro","expires_at":"2026-12-31T00:00:00Z","machine_hash":"...","signature":"..."}'
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                (async () => {
                  setLicenseMsg("");
                  const obj = JSON.parse(licenseText || "{}");
                  await apiPost("/api/license/save", { token, body: obj });
                  setLicenseMsg("OK: licença salva.");
                  await refresh();
                })().catch((e) => setLicenseMsg("Erro: " + e.message))
              }
            >
              Salvar licença
            </Button>
            {licenseMsg ? <div className="text-sm text-white/70">{licenseMsg}</div> : null}
          </div>
        </div>
      </Card>

      <Card title="Termo (LIVE)">
        <div className="text-sm text-white/70">
          Antes de operar em LIVE, o cliente precisa aceitar o termo. Esse aceite fica registrado localmente para auditoria.
        </div>
        {termErr ? <div className="mt-2 text-sm text-red-200/80">Erro ao carregar termo: {termErr}</div> : null}
        <textarea
          className="mt-3 h-[220px] w-full rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-xs outline-none focus:border-white/25"
          readOnly
          value={String(term?.text || "").trim()}
        />
        <div className="mt-2 text-xs text-white/60">Arquivo: {term?.path || "docs/TERMO_RESPONSABILIDADE.md"}</div>
      </Card>

      <Card title="Exportação (auditoria)">
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={() => download("/api/export/audit.csv", "audit.csv").catch((e) => setErr(e.message))}
          >
            Baixar audit.csv
          </Button>
          <Button
            variant="secondary"
            onClick={() => download("/api/export/trades.csv", "trades.csv").catch((e) => setErr(e.message))}
          >
            Baixar trades.csv
          </Button>
        </div>
        <div className="mt-2 text-xs text-white/60">
          Dica: envie os CSVs ao cliente para auditoria. Não inclua segredos (API_SECRET nunca é exportado).
        </div>
      </Card>
    </div>
  );
}

import React, { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet } from "../lib/api.js";

function tone(severity) {
  const s = String(severity || "").toLowerCase();
  if (s === "critical") return "bad";
  if (s === "warn" || s === "warning") return "warn";
  if (s === "success") return "good";
  return "neutral";
}

export default function Events({ token }) {
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    const [recent, st] = await Promise.all([
      apiGet("/api/events/recent?limit=200", { token }),
      apiGet("/api/events/stats", { token })
    ]);
    setRows(recent.rows || []);
    setStats(st || null);
  };

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, [token]);

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}
      <Card
        title="Eventos do Motor"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge>memória: {stats?.in_memory ?? "-"}</Badge>
            <Badge>último: {stats?.last_event_utc ? String(stats.last_event_utc).slice(11, 19) : "-"}</Badge>
            <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-sm font-extrabold">Resumo</div>
            <div className="mt-2 text-xs text-white/60">Por severidade</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {Object.entries(stats?.by_severity || {}).map(([k, v]) => (
                <Badge key={k} tone={tone(k)}>
                  {k}: {v}
                </Badge>
              ))}
            </div>
            <div className="mt-3 text-xs text-white/60">Por tipo</div>
            <div className="mt-2 max-h-[220px] overflow-auto rounded-xl border border-white/10">
              {Object.entries(stats?.by_type || {}).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-xs">
                  <span className="font-mono">{k}</span>
                  <span className="font-mono">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="text-sm font-extrabold">Feed recente</div>
            <div className="mt-2 max-h-[420px] overflow-auto rounded-xl border border-white/10">
              {!rows.length ? (
                <div className="p-3 text-sm text-white/60">Sem eventos no momento.</div>
              ) : (
                rows.map((item, idx) => (
                  <div key={`${item.ts_utc}-${idx}`} className="border-b border-white/5 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={tone(item.severity)}>{item.severity || "info"}</Badge>
                      <span className="font-mono text-xs text-white/70">{item.event_type}</span>
                      <span className="text-xs text-white/50">{String(item.ts_utc || "").replace("T", " ").slice(0, 19)}</span>
                      {item.symbol ? <Badge>{item.symbol}</Badge> : null}
                    </div>
                    <pre className="mt-2 overflow-auto rounded-xl border border-white/10 bg-black/20 p-2 text-[11px] text-white/60">
                      {JSON.stringify(item.payload || {}, null, 2)}
                    </pre>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}


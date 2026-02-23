import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import { apiGet } from "../lib/api.js";
import { fmtNumber } from "../lib/format.js";

function parseDetails(row) {
  const raw = row?.details_json;
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return { raw: String(raw) };
  }
}

function actionTone(action) {
  const a = String(action || "").toUpperCase();
  if (a === "BUY") return "good";
  if (a === "AVOID") return "bad";
  return "neutral";
}

export default function Decisions() {
  const [rows, setRows] = useState([]);
  const [sel, setSel] = useState("");
  const [onlyLatest, setOnlyLatest] = useState(true);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    const r = await apiGet("/api/decisions?limit=500");
    setRows(r.rows || []);
  };

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
  }, []);

  const rowMap = useMemo(() => new Map(rows.map((r) => [String(r.id), r])), [rows]);

  const latestBySymbol = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const r of rows) {
      const sym = String(r.symbol || "").toUpperCase();
      if (!sym || seen.has(sym)) continue;
      seen.add(sym);
      out.push(r);
    }
    return out;
  }, [rows]);

  const listRows = useMemo(() => {
    const base = onlyLatest ? latestBySymbol : rows;
    const qq = String(q || "").trim().toUpperCase();
    if (!qq) return base;
    return base.filter((r) => {
      const sym = String(r.symbol || "").toUpperCase();
      const act = String(r.action || "").toUpperCase();
      return sym.includes(qq) || act.includes(qq);
    });
  }, [onlyLatest, latestBySymbol, q, rows]);

  useEffect(() => {
    if (sel) return;
    if (listRows.length > 0) setSel(String(listRows[0].id));
  }, [listRows, sel]);

  const row = rowMap.get(String(sel));
  const details = row ? parseDetails(row) : null;
  const explain = details?.explain || details?.why || details?.rationale || null;
  const signals = details?.signals || details?.features || details || {};

  const topPick = useMemo(() => {
    const candidates = latestBySymbol.filter((r) => String(r.action || "").toUpperCase() === "BUY");
    candidates.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return candidates[0] || null;
  }, [latestBySymbol]);

  const counts = useMemo(() => {
    const base = latestBySymbol;
    const c = { BUY: 0, HOLD: 0, AVOID: 0 };
    for (const r of base) {
      const a = String(r.action || "").toUpperCase();
      if (a in c) c[a]++;
    }
    return { ...c, total: base.length };
  }, [latestBySymbol]);

  const s = signals || {};
  const metrics = [
    { k: "price", label: "Preço", fmt: (v) => fmtNumber(v, 6) },
    { k: "rsi", label: "RSI", fmt: (v) => fmtNumber(v, 1) },
    { k: "bb_low", label: "Bollinger (low)", fmt: (v) => fmtNumber(v, 6) },
    { k: "bb_high", label: "Bollinger (high)", fmt: (v) => fmtNumber(v, 6) },
    { k: "macd_hist", label: "MACD hist", fmt: (v) => fmtNumber(v, 4) },
    { k: "sentiment", label: "Sentimento", fmt: (v) => fmtNumber(v, 3) }
  ].filter((m) => Number.isFinite(Number(s?.[m.k])));

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}

      <Card
        title="Decisões (explicáveis)"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge>moedas: {counts.total}</Badge>
            <Badge tone="good">BUY: {counts.BUY}</Badge>
            <Badge>HOLD: {counts.HOLD}</Badge>
            <Badge tone="bad">AVOID: {counts.AVOID}</Badge>
            <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
              Atualizar
            </Button>
          </div>
        }
      >
        {topPick ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-black/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-white/80">
                Recomendação mais forte (última rodada): <span className="font-extrabold">{topPick.symbol}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="good">ação: BUY</Badge>
                <Badge>score: {fmtNumber(topPick.score, 3)}</Badge>
                <Badge>conf.: {fmtNumber(topPick.confidence, 3)}</Badge>
                <Button variant="secondary" onClick={() => setSel(String(topPick.id))}>
                  Ver detalhes
                </Button>
              </div>
            </div>
            <div className="mt-2 text-xs text-white/60">
              “conf.” é a força interna do sinal (não é probabilidade de ganho e não garante lucro).
            </div>
          </div>
        ) : (
          <div className="mb-3 rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm">
            Nenhuma oportunidade de BUY na última rodada (isso é normal). Use a lista abaixo para entender o porquê.
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <div className="text-xs text-white/60">Buscar (símbolo/ação)</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ex: BTC ou BUY"
                />
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 px-3 py-2 text-xs text-white/70">
                <input type="checkbox" checked={onlyLatest} onChange={(e) => setOnlyLatest(e.target.checked)} />
                Só última por moeda
              </label>
            </div>

            <div className="mt-3 max-h-[560px] overflow-auto rounded-xl border border-white/10">
              {listRows.length === 0 ? (
                <div className="p-3 text-sm text-white/60">Sem itens para mostrar.</div>
              ) : (
                <div className="flex flex-col">
                  {listRows.map((r) => {
                    const active = String(r.id) === String(sel);
                    return (
                      <button
                        key={r.id}
                        className={[
                          "flex w-full items-center justify-between gap-3 border-b border-white/5 px-3 py-2 text-left",
                          active ? "bg-white/10" : "bg-black/5 hover:bg-white/5"
                        ].join(" ")}
                        onClick={() => setSel(String(r.id))}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-extrabold">{r.symbol}</div>
                          <div className="font-mono text-xs text-white/50">{String(r.ts_utc || "").slice(0, 19)}</div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge tone={actionTone(r.action)} className="font-mono">
                            {String(r.action || "-")}
                          </Badge>
                          <div className="font-mono text-xs text-white/60">score {fmtNumber(r.score, 3)}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={actionTone(row?.action)} className="font-mono">
                ação: {row?.action ?? "-"}
              </Badge>
              <Badge>score: {row ? fmtNumber(row.score, 3) : "-"}</Badge>
              <Badge>conf.: {row ? fmtNumber(row.confidence, 3) : "-"}</Badge>
              <Badge className="font-mono">id: {row?.id ?? "-"}</Badge>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-sm font-extrabold">Por que (em português)</div>
              {!row ? (
                <div className="mt-2 text-sm text-white/60">Selecione uma decisão na lista.</div>
              ) : Array.isArray(explain) ? (
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/80">
                  {explain.map((line, idx) => (
                    <li key={idx}>{String(line)}</li>
                  ))}
                </ul>
              ) : (
                <div className="mt-2 whitespace-pre-wrap font-mono text-xs text-white/70">
                  {explain ? (typeof explain === "string" ? explain : JSON.stringify(explain, null, 2)) : "(sem explicação)"}
                </div>
              )}
              <div className="mt-3 text-xs text-white/60">
                “conf.” é a força interna do sinal (não é probabilidade de ganho e não garante lucro).
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/10 p-3">
              <div className="text-sm font-extrabold">Sinais (resumo)</div>
              {metrics.length === 0 ? (
                <div className="mt-2 text-sm text-white/60">Sem sinais numéricos disponíveis.</div>
              ) : (
                <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {metrics.map((m) => (
                    <div key={m.k} className="rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                      <div className="text-xs text-white/60">{m.label}</div>
                      <div className="mt-1 font-mono text-sm font-extrabold">{m.fmt(s[m.k])}</div>
                    </div>
                  ))}
                </div>
              )}

              <details className="mt-3 text-xs text-white/60">
                <summary className="cursor-pointer select-none text-white/70">Ver JSON completo</summary>
                <pre className="mt-2 max-h-[240px] overflow-auto rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-[11px] text-white/70">
                  {JSON.stringify(details, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}


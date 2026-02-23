import React, { useEffect, useState } from "react";
import Card from "../components/Card.jsx";
import Button from "../components/Button.jsx";
import Badge from "../components/Badge.jsx";
import MiniLine from "../components/MiniLine.jsx";
import { apiGet } from "../lib/api.js";
import { fmtNumber, fmtPct, fmtPrice } from "../lib/format.js";

export default function Market() {
  const [symbols, setSymbols] = useState("BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,XRPUSDT,DOGEUSDT");
  const [rows, setRows] = useState([]);
  const [fx, setFx] = useState(null);
  const [chartSymbol, setChartSymbol] = useState("BTCUSDT");
  const [kl, setKl] = useState([]);
  const [err, setErr] = useState("");

  const refresh = async () => {
    setErr("");
    const [t, f] = await Promise.all([
      apiGet("/api/market/tickers?symbols=" + encodeURIComponent(symbols)),
      apiGet("/api/market/usdtbrl")
    ]);
    setRows(t.rows || []);
    setFx(f);
  };

  const refreshChart = async () => {
    const r = await apiGet("/api/market/klines?symbol=" + encodeURIComponent(chartSymbol) + "&interval=15m&limit=96");
    setKl(r.closes || []);
  };

  useEffect(() => {
    refresh().catch((e) => setErr(e.message));
    refreshChart().catch(() => {});
  }, []);

  const usdtbrl = Number(fx?.price || 0);

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}

      <Card
        title="Mercados"
        right={
          <div className="flex items-center gap-2">
            <Badge>USDT/BRL: {usdtbrl > 0 ? fmtNumber(usdtbrl, 4) : "-"}</Badge>
            <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
              Atualizar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Watchlist (CSV)</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={symbols}
              onChange={(e) => setSymbols(e.target.value)}
            />
          </div>
          <Button onClick={() => refresh().catch((e) => setErr(e.message))}>Atualizar</Button>
        </div>
      </Card>

      <Card title="Gráfico rápido">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <div className="text-xs text-white/60">Símbolo</div>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
              value={chartSymbol}
              onChange={(e) => setChartSymbol(e.target.value.toUpperCase())}
            />
          </div>
          <Button variant="secondary" onClick={() => refreshChart().catch(() => {})}>
            Atualizar gráfico
          </Button>
        </div>
        <div className="mt-3">
          <MiniLine values={kl} />
        </div>
      </Card>

      <Card title="Tabela">
        <div className="flex flex-col gap-2">
          {rows.map((r) => {
            const chg = Number(r.priceChangePercent || 0);
            const tone = chg >= 0 ? "text-good" : "text-bad";
            return (
              <div key={r.symbol} className="grid grid-cols-[1.2fr_.9fr_.9fr] gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{r.symbol}</div>
                  <div className="text-xs text-white/60">
                    H {fmtPrice(r.highPrice)} • L {fmtPrice(r.lowPrice)}
                  </div>
                </div>
                <div className="text-right font-mono text-lg font-black">{fmtPrice(r.lastPrice)}</div>
                <div className={`text-right text-sm font-bold ${tone}`}>{fmtPct(chg)}</div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}


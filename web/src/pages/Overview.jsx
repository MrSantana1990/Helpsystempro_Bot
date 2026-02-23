import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card.jsx";
import Badge from "../components/Badge.jsx";
import Button from "../components/Button.jsx";
import MiniLine from "../components/MiniLine.jsx";
import { apiGet, apiPost } from "../lib/api.js";
import { fmtNumber, fmtPct, fmtPrice } from "../lib/format.js";

export default function Overview({ token, botOn }) {
  const [ov, setOv] = useState(null);
  const [tickers, setTickers] = useState([]);
  const [fx, setFx] = useState(null);
  const [mini, setMini] = useState([]);
  const [news, setNews] = useState(null);
  const [acct, setAcct] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [pfAsset, setPfAsset] = useState("BTC");
  const [pfQty, setPfQty] = useState("");
  const [marketSymbol, setMarketSymbol] = useState("BTCUSDT");
  const [balBRL, setBalBRL] = useState("");
  const [balUSDT, setBalUSDT] = useState("");
  const [topup, setTopup] = useState(null);
  const [err, setErr] = useState("");

  const refresh = async (sym = marketSymbol) => {
    setErr("");
    const [ovv, fxr, tkr, kln, acctR, pfR] = await Promise.all([
      apiGet("/api/overview"),
      apiGet("/api/market/usdtbrl"),
      apiGet("/api/market/tickers?symbols=" + encodeURIComponent("BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,XRPUSDT,DOGEUSDT")),
      apiGet("/api/market/klines?symbol=" + encodeURIComponent(sym) + "&interval=15m&limit=64"),
      apiGet("/api/account/summary").catch(() => null),
      apiGet("/api/portfolio").catch(() => ({ rows: [] }))
    ]);
    setOv(ovv);
    setFx(fxr);
    setTickers(tkr.rows || []);
    setMini(kln.closes || []);
    setAcct(acctR);
    setPortfolio((pfR && pfR.rows) || []);
    setMarketSymbol(sym);
    apiGet("/api/news?term=crypto&limit=6").then(setNews).catch(() => {});
  };

  useEffect(() => {
    refresh("BTCUSDT").catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshMarket = async (sym) => {
    setErr("");
    const kln = await apiGet("/api/market/klines?symbol=" + encodeURIComponent(sym) + "&interval=15m&limit=64");
    setMarketSymbol(sym);
    setMini(kln.closes || []);
  };

  const usdtbrl = Number(fx?.price || 0);
  const acctUsdt = acct?.enabled ? Number(acct.total_usdt || 0) : null;
  const acctBrl = acct?.enabled && Number.isFinite(Number(acct.total_brl)) ? Number(acct.total_brl) : null;
  const acctAvailUsdt = acct?.enabled ? Number(acct.available_usdt || 0) : null;
  const acctAvailBrl = acct?.enabled && Number.isFinite(Number(acct.available_brl)) ? Number(acct.available_brl) : null;

  const estUsdtFromInputs = useMemo(() => {
    const u = Number(String(balUSDT).replace(",", "."));
    const b = Number(String(balBRL).replace(",", "."));
    if (Number.isFinite(u) && u > 0) return u;
    if (Number.isFinite(b) && b > 0 && usdtbrl > 0) return b / usdtbrl;
    return null;
  }, [balBRL, balUSDT, usdtbrl]);

  const estUsdt = acct?.enabled && Number.isFinite(acctUsdt) && acctUsdt > 0 ? acctUsdt : estUsdtFromInputs;
  const estBrl = estUsdt != null && usdtbrl > 0 ? estUsdt * usdtbrl : null;

  const calcTopup = async () => {
    setErr("");
    const fromAcct = acct?.enabled && Number.isFinite(Number(acctAvailUsdt)) && Number(acctAvailUsdt) >= 0;
    const current_brl = fromAcct ? 0 : Number(String(balBRL).replace(",", ".") || 0);
    const current_usdt = fromAcct ? Number(acctAvailUsdt || 0) : Number(String(balUSDT).replace(",", ".") || 0);
    const r = await apiPost("/api/bot/recommend_topup", { token, body: { current_brl, current_usdt } });
    setTopup(r);
  };

  const savePortfolio = async (rows) => {
    setErr("");
    const r = await apiPost("/api/portfolio/save", { token, body: { rows } });
    setPortfolio(r.rows || []);
  };

  const addHolding = async () => {
    const asset = String(pfAsset || "").trim().toUpperCase();
    const qty = Number(String(pfQty).replace(",", "."));
    if (!asset) throw new Error("Informe o ativo (ex: BTC).");
    if (!Number.isFinite(qty) || qty <= 0) throw new Error("Informe a quantidade (> 0).");

    const next = [...portfolio];
    const idx = next.findIndex((x) => String(x.asset || "").toUpperCase() === asset);
    if (idx >= 0) next[idx] = { asset, qty };
    else next.push({ asset, qty });
    next.sort((a, b) => String(a.asset).localeCompare(String(b.asset)));
    await savePortfolio(next);
    setPfQty("");
  };

  const removeHolding = async (asset) => {
    const next = portfolio.filter((x) => String(x.asset || "").toUpperCase() !== String(asset || "").toUpperCase());
    await savePortfolio(next);
  };

  const marketOptions = useMemo(() => {
    const s = new Set();
    (ov?.symbols || []).forEach((x) => s.add(String(x).toUpperCase()));
    const acctRows = acct?.enabled ? acct.rows || [] : [];
    acctRows.forEach((x) => {
      const a = String(x.asset || "").toUpperCase();
      if (a && a !== "USDT") s.add(a + "USDT");
    });
    (portfolio || []).forEach((x) => {
      const a = String(x.asset || "").toUpperCase();
      if (a && a !== "USDT") s.add(a + "USDT");
    });
    const arr = Array.from(s);
    if (!arr.includes("BTCUSDT")) arr.unshift("BTCUSDT");
    return arr.slice(0, 30);
  }, [acct?.enabled, acct?.rows, ov?.symbols, portfolio]);

  return (
    <div className="flex flex-col gap-3">
      {err ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm">{err}</div> : null}

      <Card
        title="Painel de Controle"
        right={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ov?.testnet ? "good" : "warn"}>testnet: {String(!!ov?.testnet)}</Badge>
            <Badge>trades: {ov?.counts?.trades ?? "-"}</Badge>
            <Badge>decisões: {ov?.counts?.decisions ?? "-"}</Badge>
            <Badge>abertas: {ov?.counts?.open_positions ?? "-"}</Badge>
            <Badge tone={botOn ? "good" : "neutral"}>bot: {botOn ? "ON" : "OFF"}</Badge>
          </div>
        }
      >
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/60">
          <div>
            DB: <span className="font-mono text-white/80">{ov?.db_path || "-"}</span>
          </div>
          <div>
            Monitoradas: <span className="font-mono text-white/80">{(ov?.symbols || []).join(", ") || "-"}</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card title="Saldo (inteligente)" right={<Badge>USDT/BRL: {usdtbrl > 0 ? fmtNumber(usdtbrl, 4) : "-"}</Badge>}>
          {acct?.enabled ? (
            <div className="mb-3 rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-white/80">
              Carteira lida da Binance: <span className="font-mono font-extrabold">{fmtNumber(acctUsdt, 4)} USDT</span>
              {acctBrl != null ? <span className="text-white/60"> (≈ {fmtNumber(acctBrl, 2)} R$)</span> : null}
              <div className="mt-1 text-xs text-white/60">{acct.note}</div>
              <div className="mt-2 text-xs text-white/60">
                Disponível (USDT livre):{" "}
                <span className="font-mono text-white/80">{fmtNumber(acctAvailUsdt, 4)} USDT</span>
                {acctAvailBrl != null ? <span className="text-white/60"> (≈ {fmtNumber(acctAvailBrl, 2)} R$)</span> : null}
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm">
              {acct?.message || "Sem Binance API configurada. Você pode informar saldo manualmente abaixo ou salvar suas chaves em Configurações."}
            </div>
          )}

          <div className="text-3xl font-black">
            <span className="font-mono">{estUsdt != null ? fmtNumber(estUsdt, 4) : "-"}</span>{" "}
            <span className="text-white/70">USDT</span>
          </div>
          <div className="text-sm text-white/70">
            ≈ <span className="font-mono">{estBrl != null ? fmtNumber(estBrl, 2) : "-"}</span> R$
          </div>

          {!acct?.enabled ? (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <div className="text-xs text-white/60">Saldo (R$)</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                  placeholder="ex: 50"
                  value={balBRL}
                  onChange={(e) => setBalBRL(e.target.value)}
                />
              </div>
              <div>
                <div className="text-xs text-white/60">Saldo (USDT)</div>
                <input
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                  placeholder="ex: 12"
                  value={balUSDT}
                  onChange={(e) => setBalUSDT(e.target.value)}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button variant="primary" className="w-full" onClick={() => calcTopup().catch((e) => setErr(e.message))}>
                  Calcular aporte
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Button variant="primary" onClick={() => calcTopup().catch((e) => setErr(e.message))}>
                Calcular aporte (usa saldo total)
              </Button>
              <Button variant="secondary" onClick={() => refresh().catch((e) => setErr(e.message))}>
                Atualizar carteira
              </Button>
            </div>
          )}

          {acct?.enabled ? (
            <div className="mt-3">
              <div className="text-xs text-white/60">Ativos (não-zerados)</div>
              <div className="mt-2 max-h-[220px] overflow-auto rounded-xl border border-white/10">
                {(acct.rows || []).slice(0, 20).map((a) => (
                  <div key={a.asset} className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2">
                    <div className="font-extrabold">{a.asset}</div>
                    <div className="text-right">
                      <div className="font-mono text-sm">{fmtNumber(a.qty, a.asset === "USDT" ? 2 : 8)}</div>
                      <div className="text-xs text-white/60">
                        {a.value_usdt != null ? `≈ ${fmtNumber(a.value_usdt, 2)} USDT` : "sem cotação USDT"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3">
              <div className="text-xs text-white/60">Carteira manual (opcional, até você colocar a API)</div>
              <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-[140px_1fr_auto] md:items-end">
                <div>
                  <div className="text-xs text-white/60">Ativo</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                    placeholder="ex: BTC"
                    value={pfAsset}
                    onChange={(e) => setPfAsset(e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs text-white/60">Quantidade</div>
                  <input
                    className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-sm outline-none focus:border-white/25"
                    placeholder="ex: 0.01"
                    value={pfQty}
                    onChange={(e) => setPfQty(e.target.value)}
                  />
                </div>
                <Button variant="secondary" onClick={() => addHolding().catch((e) => setErr(e.message))}>
                  Salvar ativo
                </Button>
              </div>

              {portfolio.length ? (
                <div className="mt-2 max-h-[160px] overflow-auto rounded-xl border border-white/10">
                  {portfolio.map((p) => (
                    <div key={p.asset} className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-2">
                      <div className="font-extrabold">{p.asset}</div>
                      <div className="flex items-center gap-2">
                        <div className="font-mono text-sm">{fmtNumber(p.qty, 8)}</div>
                        <Button variant="secondary" onClick={() => removeHolding(p.asset).catch((e) => setErr(e.message))}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-white/60">Sem itens. (Ex.: BTC 0.01, ETH 0.2)</div>
              )}
            </div>
          )}

          {topup ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="warn">sugestão: {topup.suggestion_brl ? `R$ ${fmtNumber(topup.suggestion_brl, 0)}` : "-"}</Badge>
              <Badge>meta: {fmtNumber(topup.target_usdt, 2)} USDT</Badge>
              <Badge>faltando: {fmtNumber(topup.need_usdt, 2)} USDT</Badge>
              <div className="w-full text-xs text-white/60">{topup.note}</div>
            </div>
          ) : null}
        </Card>

        <Card
          title={`Mercado (${marketSymbol})`}
          right={
            <div className="flex items-center gap-2">
              <select
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 font-mono text-xs outline-none focus:border-white/25"
                value={marketSymbol}
                onChange={(e) => refreshMarket(e.target.value).catch((e2) => setErr(e2.message))}
              >
                {marketOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button variant="secondary" onClick={() => refreshMarket(marketSymbol).catch((e) => setErr(e.message))}>
                Atualizar
              </Button>
            </div>
          }
        >
          <MiniLine values={mini} />
          <div className="mt-2 text-xs text-white/60">Gráfico simples (close). Próximo: candle/volume estilo exchange.</div>
        </Card>
      </div>

      <Card title="Mercados (popular)">
        <div className="flex flex-col gap-2">
          {tickers.map((t) => {
            const chg = Number(t.priceChangePercent || 0);
            const tone = chg >= 0 ? "text-good" : "text-bad";
            return (
              <div
                key={t.symbol}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="truncate font-extrabold">{t.symbol}</div>
                  <div className="text-xs text-white/60">Vol 24h: {fmtNumber(t.quoteVolume, 0)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg font-black">{fmtPrice(t.lastPrice)}</div>
                  <div className={`text-sm font-bold ${tone}`}>{fmtPct(chg)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title="Notícias (resumo)" right={<Badge>sent. médio: {news?.enabled ? fmtNumber(news.avg_sentiment ?? 0, 3) : "-"}</Badge>}>
        {!news ? (
          <div className="text-sm text-white/60">Carregando...</div>
        ) : !news.enabled ? (
          <div className="rounded-xl border border-yellow-500/25 bg-yellow-500/10 p-3 text-sm">{news.message}</div>
        ) : (
          <div className="flex flex-col gap-2">
            {(news.rows || []).slice(0, 6).map((a, idx) => (
              <a
                key={idx}
                href={a.url || "#"}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 bg-black/10 p-3 hover:border-white/20"
              >
                <div className="font-extrabold">{a.title || "(sem título)"}</div>
                <div className="mt-1 text-xs text-white/60">{a.source || ""}</div>
              </a>
            ))}
          </div>
        )}
        <div className="mt-3 text-xs text-white/60">
          Sem promessa de lucro: “confidence” é um nível interno do sinal, não é probabilidade de ganho.
        </div>
      </Card>
    </div>
  );
}

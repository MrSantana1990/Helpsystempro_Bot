from __future__ import annotations

import json
import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable

from .paths import data_dir
from .storage import Storage


KNOWN_QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "TUSD", "DAI", "BRL"]


def split_symbol(symbol: str) -> tuple[str, str]:
    s = (symbol or "").strip().upper()
    for q in KNOWN_QUOTES:
        if s.endswith(q) and len(s) > len(q):
            return s[: -len(q)], q
    # fallback: assume USDT
    if s.endswith("USDT") and len(s) > 4:
        return s[:-4], "USDT"
    return s, "USDT"


def _parse_iso(ts_utc: str) -> datetime:
    # ts_utc do sistema costuma ser ISO com timezone (ex: 2026-02-22T18:43:03.363Z ou +00:00)
    s = (ts_utc or "").strip()
    if not s:
        return datetime.now(timezone.utc)
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return datetime.now(timezone.utc)


def _day_bounds_utc(now: datetime | None = None) -> tuple[str, str, str]:
    n = now or datetime.now(timezone.utc)
    start = n.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    # Mantém compatibilidade com ts_utc salvo pelo sistema (isoformat com offset).
    start_s = start.isoformat()
    end_s = end.isoformat()
    day_s = start.strftime("%Y-%m-%d")
    return day_s, start_s, end_s


def load_trades(
    storage: Storage,
    *,
    start_utc: str | None = None,
    end_utc: str | None = None,
    limit: int = 200_000,
) -> list[dict[str, Any]]:
    q = """
        SELECT id, ts_utc, symbol, side, qty, price, quote_qty, raw_json
        FROM trades
    """
    params: list[Any] = []
    wh: list[str] = []
    if start_utc:
        wh.append("ts_utc >= ?")
        params.append(start_utc)
    if end_utc:
        wh.append("ts_utc < ?")
        params.append(end_utc)
    if wh:
        q += " WHERE " + " AND ".join(wh)
    q += " ORDER BY id ASC LIMIT ?"
    params.append(int(limit))

    with storage._connect() as con:  # noqa: SLF001 (interno)
        rows = con.execute(q, tuple(params)).fetchall()
    out: list[dict[str, Any]] = []
    for rid, ts_utc, symbol, side, qty, price, quote_qty, raw_json in rows:
        out.append(
            {
                "id": int(rid),
                "ts_utc": str(ts_utc),
                "symbol": str(symbol),
                "side": str(side).upper(),
                "qty": float(qty or 0.0),
                "price": float(price or 0.0),
                "quote_qty": float(quote_qty or 0.0),
                "raw_json": raw_json,
            }
        )
    return out


@dataclass(frozen=True)
class Execution:
    trade_id: int
    ts_utc: str
    symbol: str
    side: str  # BUY | SELL
    fill_idx: int
    qty: float
    price: float
    quote: float
    commission: float
    commission_asset: str | None
    fee_usdt: float | None
    fee_usdt_source: str  # none | raw | converted


def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def expand_executions(trade: dict[str, Any]) -> list[Execution]:
    rid = int(trade.get("id") or 0)
    ts = str(trade.get("ts_utc") or "")
    symbol = str(trade.get("symbol") or "").upper()
    side = str(trade.get("side") or "").upper()

    raw = trade.get("raw_json")
    obj: dict[str, Any] = {}
    if isinstance(raw, dict):
        obj = raw
    elif isinstance(raw, str) and raw.strip():
        try:
            obj = json.loads(raw)
        except Exception:
            obj = {}

    hs = obj.get("_hs") if isinstance(obj, dict) else None
    fills = None
    if isinstance(hs, dict) and isinstance(hs.get("fills"), list):
        fills = hs.get("fills")
    elif isinstance(obj, dict) and isinstance(obj.get("fills"), list):
        fills = obj.get("fills")

    out: list[Execution] = []
    if isinstance(fills, list) and fills:
        for i, f in enumerate(fills):
            if not isinstance(f, dict):
                continue
            qty = _safe_float(f.get("qty"))
            price = _safe_float(f.get("price"))
            if qty <= 0 or price <= 0:
                continue
            quote = qty * price
            commission = _safe_float(f.get("commission"))
            commission_asset = str(f.get("commissionAsset") or "").upper() or None

            fee_usdt = None
            fee_source = "none"
            if isinstance(f.get("fee_usdt"), (int, float, str)):
                fee_usdt = _safe_float(f.get("fee_usdt"))
                fee_source = "raw"

            out.append(
                Execution(
                    trade_id=rid,
                    ts_utc=ts,
                    symbol=symbol,
                    side=side,
                    fill_idx=i,
                    qty=qty,
                    price=price,
                    quote=quote,
                    commission=commission,
                    commission_asset=commission_asset,
                    fee_usdt=fee_usdt if fee_usdt and fee_usdt > 0 else None,
                    fee_usdt_source=fee_source,
                )
            )
        if out:
            return out

    # fallback: 1 execução agregada
    qty = _safe_float(trade.get("qty"))
    price = _safe_float(trade.get("price"))
    quote = _safe_float(trade.get("quote_qty")) or (qty * price if qty > 0 and price > 0 else 0.0)
    out.append(
        Execution(
            trade_id=rid,
            ts_utc=ts,
            symbol=symbol,
            side=side,
            fill_idx=0,
            qty=qty,
            price=price,
            quote=quote,
            commission=0.0,
            commission_asset=None,
            fee_usdt=None,
            fee_usdt_source="none",
        )
    )
    return out


def _convert_fee_to_usdt(
    *,
    commission: float,
    commission_asset: str | None,
    base_asset: str,
    quote_asset: str,
    price: float,
    price_fetch_usdt: Callable[[str], float | None] | None,
) -> float | None:
    if not commission_asset or commission <= 0:
        return None
    ca = str(commission_asset).upper()
    if ca == "USDT":
        return float(commission)
    if ca == quote_asset and quote_asset == "USDT":
        return float(commission)
    if ca == base_asset and price > 0 and quote_asset == "USDT":
        return float(commission) * float(price)
    if price_fetch_usdt:
        sym = f"{ca}USDT"
        p = price_fetch_usdt(sym)
        if p and p > 0:
            return float(commission) * float(p)
    return None


@dataclass(frozen=True)
class PnlSummary:
    realized_pnl_usdt: float
    fees_usdt: float
    orders_count: int
    executions_count: int
    drawdown_usdt_est: float
    equity_usdt_est: float
    peak_usdt_est: float


def compute_realized_fifo(
    executions: Iterable[Execution],
    *,
    price_fetch_usdt: Callable[[str], float | None] | None = None,
) -> dict[str, Any]:
    """
    FIFO por símbolo, com taxas quando disponíveis.
    - Fees em USDT são somadas e consideradas no PnL.
    - Drawdown é estimado usando última cotação conhecida por símbolo (aproximação).
    """
    events = sorted(
        list(executions),
        key=lambda e: (_parse_iso(e.ts_utc).timestamp(), int(e.trade_id), int(e.fill_idx)),
    )

    lots: dict[str, list[dict[str, float]]] = {}  # symbol -> [{qty, cost_usdt}]
    last_price: dict[str, float] = {}
    cash_usdt = 0.0  # fluxo líquido

    realized_total = 0.0
    fees_total = 0.0
    realized_by_symbol: dict[str, float] = {}
    fees_by_symbol: dict[str, float] = {}
    realized_by_trade: dict[int, float] = {}
    trade_symbol: dict[int, str] = {}
    trade_ts: dict[int, str] = {}

    peak = 0.0
    max_dd = 0.0

    def equity_est() -> float:
        eq = cash_usdt
        for sym, sym_lots in lots.items():
            p = last_price.get(sym)
            if not p or p <= 0:
                continue
            qty_open = sum(x["qty"] for x in sym_lots)
            eq += qty_open * p
        return float(eq)

    for ev in events:
        trade_symbol[int(ev.trade_id)] = str(ev.symbol)
        trade_ts[int(ev.trade_id)] = str(ev.ts_utc)
        base, quote = split_symbol(ev.symbol)
        if quote != "USDT":
            # Escopo do piloto: motor/portal majoritariamente USDT. Mantém funcionamento, mas sem prometer precisão fora disso.
            continue

        last_price[ev.symbol] = float(ev.price)

        fee_usdt = ev.fee_usdt
        if fee_usdt is None and ev.commission and ev.commission_asset:
            fee_usdt = _convert_fee_to_usdt(
                commission=float(ev.commission),
                commission_asset=ev.commission_asset,
                base_asset=base,
                quote_asset=quote,
                price=float(ev.price),
                price_fetch_usdt=price_fetch_usdt,
            )

        fee_usdt = float(fee_usdt or 0.0)
        if fee_usdt > 0:
            fees_total += fee_usdt
            fees_by_symbol[ev.symbol] = float(fees_by_symbol.get(ev.symbol, 0.0) + fee_usdt)

        if ev.side == "BUY":
            # fee em base: reduz qty recebida
            net_qty = float(ev.qty)
            if ev.commission_asset and ev.commission_asset == base and ev.commission > 0:
                net_qty = max(0.0, net_qty - float(ev.commission))

            cost = float(ev.quote) + fee_usdt
            cash_usdt -= cost
            if net_qty > 0 and cost > 0:
                lots.setdefault(ev.symbol, []).append({"qty": net_qty, "cost_usdt": cost})

        elif ev.side == "SELL":
            qty_to_sell = float(ev.qty)
            proceeds = float(ev.quote) - fee_usdt
            cash_usdt += proceeds

            sym_lots = lots.get(ev.symbol) or []
            if qty_to_sell <= 0 or not sym_lots:
                continue

            proceeds_per_qty = proceeds / qty_to_sell if qty_to_sell > 0 else 0.0
            remaining = qty_to_sell

            while remaining > 1e-12 and sym_lots:
                lot = sym_lots[0]
                lot_qty = float(lot.get("qty", 0.0))
                lot_cost = float(lot.get("cost_usdt", 0.0))
                if lot_qty <= 1e-12 or lot_cost < 0:
                    sym_lots.pop(0)
                    continue

                match = min(remaining, lot_qty)
                cost_per_qty = lot_cost / lot_qty if lot_qty > 0 else 0.0
                realized = match * (proceeds_per_qty - cost_per_qty)

                realized_total += realized
                realized_by_symbol[ev.symbol] = float(realized_by_symbol.get(ev.symbol, 0.0) + realized)
                realized_by_trade[ev.trade_id] = float(realized_by_trade.get(ev.trade_id, 0.0) + realized)

                # ajusta lote
                lot_qty -= match
                remaining -= match
                if lot_qty <= 1e-12:
                    sym_lots.pop(0)
                else:
                    lot["qty"] = lot_qty
                    lot["cost_usdt"] = lot_qty * cost_per_qty

            # fee em base no SELL: remove do inventário pelo custo (sem proceeds)
            if ev.commission_asset and ev.commission_asset == base and ev.commission > 0:
                fee_qty = float(ev.commission)
                while fee_qty > 1e-12 and sym_lots:
                    lot = sym_lots[0]
                    lot_qty = float(lot.get("qty", 0.0))
                    lot_cost = float(lot.get("cost_usdt", 0.0))
                    if lot_qty <= 1e-12 or lot_cost < 0:
                        sym_lots.pop(0)
                        continue
                    take = min(fee_qty, lot_qty)
                    cost_per_qty = lot_cost / lot_qty if lot_qty > 0 else 0.0
                    realized_total -= take * cost_per_qty
                    realized_by_symbol[ev.symbol] = float(realized_by_symbol.get(ev.symbol, 0.0) - take * cost_per_qty)
                    realized_by_trade[ev.trade_id] = float(realized_by_trade.get(ev.trade_id, 0.0) - take * cost_per_qty)
                    lot_qty -= take
                    fee_qty -= take
                    if lot_qty <= 1e-12:
                        sym_lots.pop(0)
                    else:
                        lot["qty"] = lot_qty
                        lot["cost_usdt"] = lot_qty * cost_per_qty

            lots[ev.symbol] = sym_lots

        # equity/drawdown estimado (após cada evento)
        eq = equity_est()
        peak = max(peak, eq)
        dd = peak - eq
        max_dd = max(max_dd, dd)

    open_positions = []
    for sym, sym_lots in lots.items():
        qty = sum(x["qty"] for x in sym_lots)
        cost = sum(x["cost_usdt"] for x in sym_lots)
        if qty <= 0:
            continue
        open_positions.append(
            {
                "symbol": sym,
                "qty": float(qty),
                "cost_usdt": float(cost),
                "avg_cost_usdt": float(cost / qty) if qty > 0 else None,
                "last_price_usdt": float(last_price.get(sym) or 0.0) or None,
            }
        )

    open_positions.sort(key=lambda x: float(x.get("cost_usdt") or 0.0), reverse=True)

    # monta breakdown por trade (ordem)
    trade_rows: list[dict[str, Any]] = []
    for tid, pnl in sorted(realized_by_trade.items(), key=lambda x: int(x[0])):
        trade_rows.append(
            {
                "trade_id": int(tid),
                "symbol": trade_symbol.get(int(tid)),
                "ts_utc": trade_ts.get(int(tid)),
                "realized_pnl_usdt": float(pnl),
            }
        )

    summary = PnlSummary(
        realized_pnl_usdt=float(realized_total),
        fees_usdt=float(fees_total),
        orders_count=int(len({e.trade_id for e in events})),
        executions_count=int(len(events)),
        drawdown_usdt_est=float(max_dd),
        equity_usdt_est=float(equity_est()),
        peak_usdt_est=float(peak),
    )

    return {
        "method": {
            "inventory": "FIFO",
            "fees": "incluídas quando disponíveis (fills/commission).",
            "notes": [
                "Escopo do piloto: pares USDT.",
                "Drawdown é estimado usando última cotação conhecida por símbolo (não é mark-to-market perfeito).",
            ],
        },
        "summary": {
            "realized_pnl_usdt": summary.realized_pnl_usdt,
            "fees_usdt": summary.fees_usdt,
            "orders_count": summary.orders_count,
            "executions_count": summary.executions_count,
            "equity_usdt_est": summary.equity_usdt_est,
            "peak_usdt_est": summary.peak_usdt_est,
            "drawdown_usdt_est": summary.drawdown_usdt_est,
        },
        "by_symbol": {
            sym: {
                "realized_pnl_usdt": float(realized_by_symbol.get(sym, 0.0)),
                "fees_usdt": float(fees_by_symbol.get(sym, 0.0)),
            }
            for sym in sorted(set(list(realized_by_symbol.keys()) + list(fees_by_symbol.keys())))
        },
        "by_trade": trade_rows,
        "open_positions": open_positions,
    }


def realized_today(storage: Storage, *, limit: int = 200_000, price_fetch_usdt: Callable[[str], float | None] | None = None) -> dict[str, Any]:
    _, start_s, end_s = _day_bounds_utc()
    trades = load_trades(storage, start_utc=start_s, end_utc=end_s, limit=limit)
    executions: list[Execution] = []
    for t in trades:
        executions.extend(expand_executions(t))
    return compute_realized_fifo(executions, price_fetch_usdt=price_fetch_usdt)

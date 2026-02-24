from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import load_settings
from .storage import Storage


@dataclass(frozen=True)
class DailyRiskStats:
    day_utc: str
    buy_quote_usdt: float
    sell_quote_usdt: float
    realized_pnl_usdt: float
    trades_count: int


def _day_bounds_utc(now: datetime | None = None) -> tuple[str, str, str]:
    n = now or datetime.now(timezone.utc)
    start = n.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    # ISO com Z para comparaÃ§Ã£o lexicogrÃ¡fica no SQLite.
    start_s = start.strftime("%Y-%m-%dT%H:%M:%SZ")
    end_s = end.strftime("%Y-%m-%dT%H:%M:%SZ")
    day_s = start.strftime("%Y-%m-%d")
    return day_s, start_s, end_s


def _iter_trades_today(storage: Storage) -> list[dict[str, Any]]:
    day_s, start_s, end_s = _day_bounds_utc()
    # ts_utc no DB Ã© ISO string; usamos janela [start, end)
    with storage._connect() as con:  # noqa: SLF001 (DB interno)
        rows = con.execute(
            """
            SELECT ts_utc, symbol, side, qty, quote_qty
            FROM trades
            WHERE ts_utc >= ? AND ts_utc < ?
            ORDER BY id ASC
            """,
            (start_s, end_s),
        ).fetchall()
    out: list[dict[str, Any]] = []
    for ts_utc, symbol, side, qty, quote_qty in rows:
        out.append(
            {
                "ts_utc": str(ts_utc),
                "symbol": str(symbol),
                "side": str(side).upper(),
                "qty": float(qty or 0.0),
                "quote_qty": float(quote_qty or 0.0),
            }
        )
    return out


def compute_daily_risk_stats(storage: Storage) -> DailyRiskStats:
    s = load_settings()
    day_s, _, _ = _day_bounds_utc()
    trades = _iter_trades_today(storage)

    buy_quote = sum(t["quote_qty"] for t in trades if t["side"] == "BUY")
    sell_quote = sum(t["quote_qty"] for t in trades if t["side"] == "SELL")

    # Realized PnL aproximado via FIFO buy/sell (sem fees).
    open_lots: dict[str, list[tuple[float, float]]] = {}
    realized = 0.0
    for t in trades:
        sym = str(t["symbol"]).upper()
        qty = float(t["qty"] or 0.0)
        q = float(t["quote_qty"] or 0.0)
        if qty <= 0 or q <= 0:
            continue

        if t["side"] == "BUY":
            open_lots.setdefault(sym, []).append((qty, q))
            continue

        if t["side"] != "SELL":
            continue

        remaining = qty
        sell_per_qty = q / qty
        lots = open_lots.get(sym) or []
        while remaining > 1e-12 and lots:
            lot_qty, lot_quote = lots[0]
            match = min(remaining, lot_qty)
            buy_per_qty = lot_quote / lot_qty
            realized += match * (sell_per_qty - buy_per_qty)
            lot_qty -= match
            remaining -= match
            if lot_qty <= 1e-12:
                lots.pop(0)
            else:
                # ajusta lote parcial
                lots[0] = (lot_qty, lot_qty * buy_per_qty)
        open_lots[sym] = lots

    return DailyRiskStats(
        day_utc=day_s,
        buy_quote_usdt=float(buy_quote),
        sell_quote_usdt=float(sell_quote),
        realized_pnl_usdt=float(realized),
        trades_count=int(len(trades)),
    )


@dataclass(frozen=True)
class RiskDecision:
    ok_to_buy: bool
    reason: str
    stats: DailyRiskStats
    limits: dict[str, float]


def evaluate_risk_limits(storage: Storage) -> RiskDecision:
    """
    Regras simples (Local-first):
    - Limita o volume comprado no dia (quote USDT).
    - Limita perda realizada no dia (USDT).

    ObservaÃ§Ã£o: nÃ£o Ã© promessa de resultado; Ã© apenas trava operacional.
    """
    s = load_settings()
    stats = compute_daily_risk_stats(storage)

    max_buy_quote = float(s.get("risk_max_daily_buy_quote_usdt", 0.0) or 0.0)
    max_daily_loss = float(s.get("risk_max_daily_loss_usdt", 0.0) or 0.0)

    limits = {
        "risk_max_daily_buy_quote_usdt": max_buy_quote,
        "risk_max_daily_loss_usdt": max_daily_loss,
    }

    # Se nÃ£o configurado, nÃ£o libera compras em modo live (proteÃ§Ã£o).
    if not bool(s.get("testnet", True)):
        if max_buy_quote <= 0 or max_daily_loss <= 0:
            return RiskDecision(
                ok_to_buy=False,
                reason="Limites de risco obrigatÃ³rios nÃ£o configurados para LIVE (defina risk_max_daily_buy_quote_usdt e risk_max_daily_loss_usdt).",
                stats=stats,
                limits=limits,
            )

    if max_buy_quote > 0 and stats.buy_quote_usdt >= max_buy_quote:
        return RiskDecision(
            ok_to_buy=False,
            reason=f"Limite diÃ¡rio de compras atingido: {stats.buy_quote_usdt:.2f} / {max_buy_quote:.2f} USDT.",
            stats=stats,
            limits=limits,
        )

    if max_daily_loss > 0 and stats.realized_pnl_usdt <= -abs(max_daily_loss):
        return RiskDecision(
            ok_to_buy=False,
            reason=f"Kill switch por perda diÃ¡ria: PnL={stats.realized_pnl_usdt:.2f} USDT (limite {max_daily_loss:.2f}).",
            stats=stats,
            limits=limits,
        )

    return RiskDecision(ok_to_buy=True, reason="OK", stats=stats, limits=limits)


from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .config import load_settings
from .pnl import compute_realized_fifo, expand_executions, load_trades
from .storage import Storage


@dataclass(frozen=True)
class DailyRiskStats:
    day_utc: str
    buy_quote_usdt: float
    sell_quote_usdt: float
    realized_pnl_usdt: float
    fees_usdt: float
    orders_count: int
    executions_count: int
    drawdown_usdt_est: float


def _day_bounds_utc(now: datetime | None = None) -> tuple[str, str, str]:
    n = now or datetime.now(timezone.utc)
    start = n.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    # Compatível com ts_utc salvo (isoformat com offset).
    return start.strftime("%Y-%m-%d"), start.isoformat(), end.isoformat()


def compute_daily_risk_stats(storage: Storage) -> DailyRiskStats:
    day_s, start_s, end_s = _day_bounds_utc()
    trades = load_trades(storage, start_utc=start_s, end_utc=end_s, limit=200_000)
    executions = []
    for t in trades:
        executions.extend(expand_executions(t))

    pnl = compute_realized_fifo(executions, price_fetch_usdt=None)
    summary = pnl.get("summary") or {}

    buy_quote = sum(e.quote for e in executions if e.side == "BUY")
    sell_quote = sum(e.quote for e in executions if e.side == "SELL")

    return DailyRiskStats(
        day_utc=day_s,
        buy_quote_usdt=float(buy_quote),
        sell_quote_usdt=float(sell_quote),
        realized_pnl_usdt=float(summary.get("realized_pnl_usdt") or 0.0),
        fees_usdt=float(summary.get("fees_usdt") or 0.0),
        orders_count=int(summary.get("orders_count") or 0),
        executions_count=int(summary.get("executions_count") or 0),
        drawdown_usdt_est=float(summary.get("drawdown_usdt_est") or 0.0),
    )


@dataclass(frozen=True)
class RiskDecision:
    ok_to_buy: bool
    reason: str
    stats: DailyRiskStats
    limits: dict[str, float]


def evaluate_risk_limits(storage: Storage) -> RiskDecision:
    """
    Regras (Local-first):
    - Limite diário de compras (USDT).
    - Perda diária realizada (USDT).
    - (Opcional) limite de ordens/dia.
    - (Opcional) drawdown estimado (equity curve simples).

    Observação: não é promessa de resultado; é apenas trava operacional.
    """
    s = load_settings()
    stats = compute_daily_risk_stats(storage)

    max_buy_quote = float(s.get("risk_max_daily_buy_quote_usdt", 0.0) or 0.0)
    max_daily_loss = float(s.get("risk_max_daily_loss_usdt", 0.0) or 0.0)
    max_orders_per_day = float(s.get("risk_max_orders_per_day", 0.0) or 0.0)
    max_drawdown_usdt = float(s.get("risk_max_drawdown_usdt", 0.0) or 0.0)

    limits = {
        "risk_max_daily_buy_quote_usdt": max_buy_quote,
        "risk_max_daily_loss_usdt": max_daily_loss,
        "risk_max_orders_per_day": max_orders_per_day,
        "risk_max_drawdown_usdt": max_drawdown_usdt,
    }

    # Em LIVE, mantém os dois limites principais obrigatórios.
    if not bool(s.get("testnet", True)):
        if max_buy_quote <= 0 or max_daily_loss <= 0:
            return RiskDecision(
                ok_to_buy=False,
                reason="Limites de risco obrigatórios não configurados para LIVE (defina risk_max_daily_buy_quote_usdt e risk_max_daily_loss_usdt).",
                stats=stats,
                limits=limits,
            )

    if max_buy_quote > 0 and stats.buy_quote_usdt >= max_buy_quote:
        return RiskDecision(
            ok_to_buy=False,
            reason=f"Limite diário de compras atingido: {stats.buy_quote_usdt:.2f} / {max_buy_quote:.2f} USDT.",
            stats=stats,
            limits=limits,
        )

    if max_daily_loss > 0 and stats.realized_pnl_usdt <= -abs(max_daily_loss):
        return RiskDecision(
            ok_to_buy=False,
            reason=f"Kill switch por perda diária: PnL={stats.realized_pnl_usdt:.2f} USDT (limite {max_daily_loss:.2f}).",
            stats=stats,
            limits=limits,
        )

    if max_orders_per_day > 0 and stats.orders_count >= int(max_orders_per_day):
        return RiskDecision(
            ok_to_buy=False,
            reason=f"Limite de ordens por dia atingido: {stats.orders_count} / {int(max_orders_per_day)}.",
            stats=stats,
            limits=limits,
        )

    if max_drawdown_usdt > 0 and stats.drawdown_usdt_est >= abs(max_drawdown_usdt):
        return RiskDecision(
            ok_to_buy=False,
            reason=f"Kill switch por drawdown estimado: {stats.drawdown_usdt_est:.2f} USDT (limite {max_drawdown_usdt:.2f}).",
            stats=stats,
            limits=limits,
        )

    return RiskDecision(ok_to_buy=True, reason="OK", stats=stats, limits=limits)


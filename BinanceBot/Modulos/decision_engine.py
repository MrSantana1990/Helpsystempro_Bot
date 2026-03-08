from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any

from .config import load_settings
from .event_engine import build_event_context
from .regime_engine import (
    calculate_position_size_multiplier,
    detect_market_regime,
    regime_signal_score,
)
from .trading_strategy import (
    calcular_bollinger_bands,
    calcular_macd,
    calcular_rsi,
    carregar_historico,
)


@dataclass(frozen=True)
class Decision:
    symbol: str
    action: str
    score: float
    confidence: float
    explain: list[str]
    signals: dict[str, Any]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _safe_float(v: Any) -> float:
    try:
        return float(v)
    except Exception:
        return 0.0


def _technical_score(closes, settings: dict[str, Any]) -> tuple[float, list[str], dict[str, Any]]:
    explain: list[str] = []
    signals: dict[str, Any] = {}

    rsi_series = calcular_rsi(closes)
    rsi = float(rsi_series.iloc[-1]) if rsi_series is not None else None
    signals["rsi"] = rsi
    price = float(closes.iloc[-1])
    signals["price"] = price

    bb_low, bb_mid, bb_high = calcular_bollinger_bands(closes)
    if bb_low is not None and bb_mid is not None and bb_high is not None:
        signals["bb_low"] = float(bb_low.iloc[-1])
        signals["bb_mid"] = float(bb_mid.iloc[-1])
        signals["bb_high"] = float(bb_high.iloc[-1])

    macd, macd_signal, macd_hist = calcular_macd(closes)
    if macd is not None and macd_signal is not None and macd_hist is not None:
        signals["macd"] = float(macd.iloc[-1])
        signals["macd_signal"] = float(macd_signal.iloc[-1])
        signals["macd_hist"] = float(macd_hist.iloc[-1])

    rsi_buy = float(settings.get("rsi_compra", 30))
    rsi_sell = float(settings.get("rsi_venda", 70))
    if rsi is None:
        rsi_component = 0.0
    elif rsi <= rsi_buy:
        rsi_component = 1.0
        explain.append(f"RSI {rsi:.1f} em sobrevenda.")
    elif rsi >= rsi_sell:
        rsi_component = -1.0
        explain.append(f"RSI {rsi:.1f} em sobrecompra.")
    else:
        mid = (rsi_buy + rsi_sell) / 2.0
        rng = max(1.0, (rsi_sell - rsi_buy) / 2.0)
        rsi_component = _clamp((mid - rsi) / rng, -1.0, 1.0)
        explain.append(f"RSI {rsi:.1f} em faixa neutra.")

    bb_component = 0.0
    if "bb_low" in signals and "bb_high" in signals and "bb_mid" in signals:
        low = _safe_float(signals["bb_low"])
        high = _safe_float(signals["bb_high"])
        mid = _safe_float(signals["bb_mid"])
        if price <= low:
            bb_component = 1.0
            explain.append("Preço abaixo/na banda inferior.")
        elif price >= high:
            bb_component = -0.8
            explain.append("Preço na banda superior.")
        else:
            den = max((high - low), 1e-9)
            bb_component = _clamp((mid - price) / den * 2.0, -0.5, 0.5)

    macd_component = 0.0
    if "macd_hist" in signals:
        hist = _safe_float(signals["macd_hist"])
        macd_component = _clamp(hist * 8.0, -1.0, 1.0)
        if hist > 0:
            explain.append("MACD favorecendo alta.")
        elif hist < 0:
            explain.append("MACD desfavorável.")

    technical_score = _clamp(rsi_component * 0.5 + bb_component * 0.3 + macd_component * 0.2, -1.0, 1.0)
    signals["technical_components"] = {
        "rsi": rsi_component,
        "bollinger": bb_component,
        "macd": macd_component,
    }
    signals["technical_score"] = technical_score
    return technical_score, explain, signals


def score_symbol(
    client,
    symbol: str,
    sentiment: float,
    *,
    news_rows: list[dict[str, Any]] | None = None,
) -> Decision:
    settings = load_settings()
    closes, _ = carregar_historico(client, symbol)
    explain: list[str] = []
    signals: dict[str, Any] = {"sentiment": _clamp(float(sentiment), -1.0, 1.0), "decision_engine": "v2.0"}

    if closes.empty or closes.isnull().any() or len(closes) < 50:
        return Decision(
            symbol=symbol,
            action="AVOID",
            score=-1.0,
            confidence=0.1,
            explain=["Sem histórico suficiente para calcular indicadores com segurança."],
            signals=signals,
        )

    technical_score, tech_explain, tech_signals = _technical_score(closes, settings)
    explain.extend(tech_explain)
    signals.update(tech_signals)

    regime = detect_market_regime(client, symbol)
    event_ctx = build_event_context(client, symbol, sentiment, news_rows=news_rows)
    regime_score = regime_signal_score(regime.name)
    sentiment_score = _clamp(float(sentiment), -1.0, 1.0)

    ws = settings.get("decision_v2_weights", {}) or {}
    decision_v2_enabled = str(os.getenv("HSP_PLAN_DECISION_V2", "1")).strip().lower() not in {"0", "false", "no"}
    if decision_v2_enabled:
        w_tech = float(ws.get("technical", 0.35))
        w_sent = float(ws.get("sentiment", 0.20))
        w_event = float(ws.get("event", 0.20))
        w_regime = float(ws.get("regime", 0.15))
        w_liq = float(ws.get("liquidity", 0.10))
    else:
        w_tech = 0.75
        w_sent = 0.25
        w_event = 0.0
        w_regime = 0.0
        w_liq = 0.0

    weighted = (
        technical_score * w_tech
        + sentiment_score * w_sent
        + float(event_ctx.event_score) * w_event
        + float(regime_score) * w_regime
        + float(event_ctx.liquidity_score) * w_liq
    )
    score = _clamp(weighted, -1.0, 1.0)
    confidence = _clamp(
        0.25
        + abs(score) * 0.4
        + float(regime.confidence) * 0.2
        + float(event_ctx.confidence) * 0.15,
        0.05,
        0.98,
    )
    position_multiplier = calculate_position_size_multiplier(
        confidence=confidence,
        regime_multiplier=regime.regime_multiplier,
        volatility_1h=regime.volatility_1h,
    )

    signals["regime_score"] = regime_score
    signals["event_score"] = float(event_ctx.event_score)
    signals["liquidity_score"] = float(event_ctx.liquidity_score)
    signals["sentiment_score"] = sentiment_score
    signals["weights"] = {
        "technical": w_tech,
        "sentiment": w_sent,
        "event": w_event,
        "regime": w_regime,
        "liquidity": w_liq,
    }
    signals["regime"] = regime.to_dict()
    signals["event_context"] = event_ctx.to_dict()
    signals["position_size_multiplier"] = float(position_multiplier)

    buy_threshold = float(settings.get("buy_threshold", 0.45))
    avoid_threshold = float(settings.get("avoid_threshold", -0.20))

    if score >= buy_threshold:
        action = "BUY"
        explain.insert(0, f"Score {score:.2f} >= {buy_threshold:.2f}: compra validada pelo motor de decisão 2.0.")
    elif score <= avoid_threshold:
        action = "AVOID"
        explain.insert(0, f"Score {score:.2f} <= {avoid_threshold:.2f}: entrada rejeitada por risco/qualidade de sinal.")
    else:
        action = "HOLD"
        explain.insert(0, f"Score {score:.2f} entre limites: aguardar confirmação melhor.")

    explain.append(
        "Componentes: "
        + f"técnico={technical_score:.2f}, "
        + f"evento={event_ctx.event_score:.2f}, "
        + f"regime={regime_score:.2f}, "
        + f"liquidez={event_ctx.liquidity_score:.2f}, "
        + f"sentimento={sentiment_score:.2f}."
    )
    explain.append(
        f"Regime detectado: {regime.name} (confiança {regime.confidence:.2f}, risco {regime.risk_level}). "
        f"Multiplicador de posição: {position_multiplier:.2f}x."
    )
    if event_ctx.risk_flags:
        explain.append("Alertas de evento/liquidez: " + ", ".join(event_ctx.risk_flags) + ".")

    return Decision(
        symbol=symbol,
        action=action,
        score=score,
        confidence=confidence,
        explain=explain,
        signals=signals,
    )

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import load_settings
from .trading_strategy import carregar_historico


@dataclass(frozen=True)
class MarketRegime:
    name: str
    confidence: float
    volatility_1h: float
    momentum_24h: float
    trend_strength: float
    regime_multiplier: float
    risk_level: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "confidence": self.confidence,
            "volatility_1h": self.volatility_1h,
            "momentum_24h": self.momentum_24h,
            "trend_strength": self.trend_strength,
            "regime_multiplier": self.regime_multiplier,
            "risk_level": self.risk_level,
        }


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def regime_signal_score(regime_name: str) -> float:
    mapping = {
        "bull_trend": 0.75,
        "sideways": 0.1,
        "neutral": 0.0,
        "high_volatility": -0.45,
        "bear_trend": -0.6,
        "panic": -0.9,
    }
    return float(mapping.get(str(regime_name or "").lower(), 0.0))


def detect_market_regime(client, symbol: str) -> MarketRegime:
    closes, _ = carregar_historico(client, symbol, limite=160)
    if closes.empty or len(closes) < 60:
        return MarketRegime(
            name="neutral",
            confidence=0.2,
            volatility_1h=0.0,
            momentum_24h=0.0,
            trend_strength=0.0,
            regime_multiplier=1.0,
            risk_level="medium",
        )

    returns = closes.pct_change().dropna()
    vol_1h = float(returns.tail(24).std()) if len(returns) >= 24 else float(returns.std())
    price = float(closes.iloc[-1])
    price_24h = float(closes.iloc[-25]) if len(closes) >= 25 else float(closes.iloc[0])
    momentum_24h = (price / price_24h - 1.0) if price_24h > 0 else 0.0

    sma20 = float(closes.rolling(window=20).mean().iloc[-1])
    sma50 = float(closes.rolling(window=50).mean().iloc[-1])
    trend_strength = abs((sma20 - sma50) / price) if price > 0 else 0.0

    if vol_1h >= 0.05 and momentum_24h <= -0.03:
        regime = "panic"
    elif trend_strength >= 0.012 and momentum_24h >= 0.012:
        regime = "bull_trend"
    elif trend_strength >= 0.012 and momentum_24h <= -0.012:
        regime = "bear_trend"
    elif vol_1h >= 0.03:
        regime = "high_volatility"
    elif abs(momentum_24h) <= 0.008 and trend_strength <= 0.006:
        regime = "sideways"
    else:
        regime = "neutral"

    multiplier_map = {
        "bull_trend": 1.15,
        "sideways": 0.85,
        "neutral": 1.0,
        "high_volatility": 0.6,
        "bear_trend": 0.65,
        "panic": 0.45,
    }
    risk_map = {
        "bull_trend": "low",
        "sideways": "medium",
        "neutral": "medium",
        "high_volatility": "high",
        "bear_trend": "high",
        "panic": "critical",
    }

    confidence = _clamp(0.35 + trend_strength * 18 + abs(momentum_24h) * 8 + vol_1h * 2, 0.2, 0.95)
    return MarketRegime(
        name=regime,
        confidence=confidence,
        volatility_1h=vol_1h,
        momentum_24h=momentum_24h,
        trend_strength=trend_strength,
        regime_multiplier=float(multiplier_map.get(regime, 1.0)),
        risk_level=str(risk_map.get(regime, "medium")),
    )


def calculate_position_size_multiplier(
    *,
    confidence: float,
    regime_multiplier: float,
    volatility_1h: float,
) -> float:
    settings = load_settings()
    volatility_target = float(settings.get("regime_volatility_target_1h", 0.018) or 0.018)
    min_mult = float(settings.get("position_size_min_multiplier", 0.25) or 0.25)
    max_mult = float(settings.get("position_size_max_multiplier", 1.5) or 1.5)

    conf_factor = 0.6 + _clamp(confidence, 0.0, 1.0) * 0.8
    vol_factor = _clamp(volatility_target / max(volatility_1h, 1e-6), 0.4, 1.3)
    mult = float(regime_multiplier) * conf_factor * vol_factor
    return _clamp(mult, min_mult, max_mult)

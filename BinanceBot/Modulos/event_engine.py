from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import load_settings


@dataclass(frozen=True)
class EventSignal:
    kind: str
    score: float
    message: str
    confidence: float
    data: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind,
            "score": self.score,
            "message": self.message,
            "confidence": self.confidence,
            "data": self.data,
        }


@dataclass(frozen=True)
class EventContext:
    event_score: float
    liquidity_score: float
    confidence: float
    signals: list[EventSignal]
    risk_flags: list[str]
    ticker: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "event_score": self.event_score,
            "liquidity_score": self.liquidity_score,
            "confidence": self.confidence,
            "signals": [s.to_dict() for s in self.signals],
            "risk_flags": list(self.risk_flags),
            "ticker": dict(self.ticker),
        }


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def _safe_float(value: Any) -> float:
    try:
        return float(value)
    except Exception:
        return 0.0


def _keyword_hits(news_rows: list[dict[str, Any]], max_items: int) -> tuple[float, list[EventSignal], list[str]]:
    positives = {
        "aprova": 0.24,
        "approval": 0.24,
        "etf": 0.2,
        "parceria": 0.16,
        "partnership": 0.16,
        "listagem": 0.18,
        "listing": 0.18,
        "adoption": 0.14,
        "adoção": 0.14,
        "upgrade": 0.12,
    }
    negatives = {
        "hack": -0.32,
        "ataque": -0.3,
        "exploit": -0.3,
        "ban": -0.24,
        "bloqueio": -0.24,
        "regulação": -0.16,
        "regulation": -0.16,
        "process": -0.14,
        "queda": -0.12,
        "liquidação": -0.2,
        "liquidation": -0.2,
    }

    selected = list(news_rows or [])[: max(1, int(max_items))]
    total = 0.0
    signals: list[EventSignal] = []
    flags: list[str] = []
    for item in selected:
        title = str(item.get("title") or "")
        desc = str(item.get("description") or "")
        text = f"{title} {desc}".lower()
        hit_score = 0.0
        for k, v in positives.items():
            if k in text:
                hit_score += float(v)
        for k, v in negatives.items():
            if k in text:
                hit_score += float(v)
        if abs(hit_score) < 1e-6:
            continue
        clipped = _clamp(hit_score, -1.0, 1.0)
        total += clipped
        msg = f"Notícia detectada: {title[:90]}"
        signals.append(
            EventSignal(
                kind="news_keyword",
                score=clipped,
                message=msg,
                confidence=_clamp(0.45 + abs(clipped) * 0.35, 0.1, 0.95),
                data={"title": title, "url": item.get("url")},
            )
        )
        if clipped <= -0.35:
            flags.append("noticia_risco_alto")

    normalized = _clamp(total / max(1.0, len(selected) * 0.7), -1.0, 1.0)
    return normalized, signals[:5], flags


def _market_score_from_ticker(ticker: dict[str, Any]) -> tuple[float, EventSignal, list[str]]:
    pct = _safe_float(ticker.get("priceChangePercent")) / 100.0
    quote_volume = _safe_float(ticker.get("quoteVolume"))

    score = 0.0
    if pct >= 0.08:
        score += 0.42
    elif pct >= 0.03:
        score += 0.22
    elif pct <= -0.08:
        score -= 0.46
    elif pct <= -0.03:
        score -= 0.24

    if quote_volume >= 70_000_000:
        score += 0.12 if pct >= 0 else -0.06
    elif quote_volume < 1_000_000:
        score -= 0.1

    flags: list[str] = []
    if pct <= -0.1:
        flags.append("queda_24h_extrema")
    signal = EventSignal(
        kind="market_24h",
        score=_clamp(score, -1.0, 1.0),
        message=f"Variação 24h {pct * 100:.2f}% e volume {quote_volume:,.0f}.",
        confidence=_clamp(0.35 + abs(pct) * 2.5, 0.1, 0.95),
        data={"priceChangePercent": pct * 100.0, "quoteVolume": quote_volume},
    )
    return _clamp(score, -1.0, 1.0), signal, flags


def _liquidity_from_ticker(ticker: dict[str, Any]) -> tuple[float, EventSignal, list[str]]:
    bid = _safe_float(ticker.get("bidPrice"))
    ask = _safe_float(ticker.get("askPrice"))
    quote_volume = _safe_float(ticker.get("quoteVolume"))

    mid = (bid + ask) / 2 if bid > 0 and ask > 0 else 0.0
    spread_pct = ((ask - bid) / mid) if mid > 0 else 0.02

    score = 0.0
    if spread_pct <= 0.0008:
        score += 0.35
    elif spread_pct <= 0.002:
        score += 0.15
    elif spread_pct >= 0.01:
        score -= 0.45
    else:
        score -= 0.1

    if quote_volume >= 50_000_000:
        score += 0.35
    elif quote_volume >= 10_000_000:
        score += 0.15
    elif quote_volume < 1_000_000:
        score -= 0.25

    flags: list[str] = []
    if spread_pct >= 0.01:
        flags.append("spread_alto")
    if quote_volume < 1_000_000:
        flags.append("liquidez_baixa")

    signal = EventSignal(
        kind="liquidity",
        score=_clamp(score, -1.0, 1.0),
        message=f"Spread {spread_pct * 100:.3f}% e volume {quote_volume:,.0f}.",
        confidence=_clamp(0.4 + abs(score) * 0.25, 0.1, 0.95),
        data={"spread_pct": spread_pct * 100.0, "quoteVolume": quote_volume},
    )
    return _clamp(score, -1.0, 1.0), signal, flags


def build_event_context(
    client,
    symbol: str,
    sentiment: float,
    *,
    news_rows: list[dict[str, Any]] | None = None,
) -> EventContext:
    settings = load_settings()
    max_news = int(settings.get("event_news_max_items", 20) or 20)
    news_weight = float(settings.get("event_news_weight", 0.5) or 0.5)
    market_weight = float(settings.get("event_market_weight", 0.3) or 0.3)
    sentiment_weight = float(settings.get("event_sentiment_weight", 0.2) or 0.2)

    ticker_obj: dict[str, Any]
    try:
        ticker_obj = client.get_ticker(symbol=symbol) or {}
    except Exception:
        ticker_obj = {}

    news_score, news_signals, news_flags = _keyword_hits(list(news_rows or []), max_news)
    market_score, market_signal, market_flags = _market_score_from_ticker(ticker_obj)
    liquidity_score, liquidity_signal, liquidity_flags = _liquidity_from_ticker(ticker_obj)

    sent_score = _clamp(float(sentiment), -1.0, 1.0)
    sent_signal = EventSignal(
        kind="news_sentiment",
        score=sent_score,
        message=f"Sentimento agregado de notícias: {sent_score:.3f}.",
        confidence=_clamp(0.25 + abs(sent_score) * 0.5, 0.1, 0.95),
        data={"sentiment": sent_score},
    )

    event_score = _clamp(news_score * news_weight + market_score * market_weight + sent_score * sentiment_weight, -1.0, 1.0)
    confidence = _clamp(
        0.3 + abs(event_score) * 0.4 + abs(liquidity_score) * 0.15 + min(0.2, len(news_signals) * 0.03),
        0.1,
        0.95,
    )

    signals = [market_signal, liquidity_signal, sent_signal, *news_signals]
    flags = list(dict.fromkeys([*news_flags, *market_flags, *liquidity_flags]))
    ticker_public = {
        "lastPrice": _safe_float(ticker_obj.get("lastPrice")),
        "priceChangePercent": _safe_float(ticker_obj.get("priceChangePercent")),
        "quoteVolume": _safe_float(ticker_obj.get("quoteVolume")),
        "bidPrice": _safe_float(ticker_obj.get("bidPrice")),
        "askPrice": _safe_float(ticker_obj.get("askPrice")),
    }
    return EventContext(
        event_score=event_score,
        liquidity_score=liquidity_score,
        confidence=confidence,
        signals=signals,
        risk_flags=flags,
        ticker=ticker_public,
    )

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .config import load_settings
from .trading_strategy import (
    calcular_bollinger_bands,
    calcular_macd,
    calcular_rsi,
    carregar_historico,
)


@dataclass(frozen=True)
class Decision:
    symbol: str
    action: str  # BUY | HOLD | AVOID
    score: float
    confidence: float
    explain: list[str]
    signals: dict[str, Any]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def score_symbol(client, symbol: str, sentiment: float) -> Decision:
    """
    Motor simples e explicável (sem ML):
    - Converte sinais (RSI, Bollinger, MACD e variação 24h) em score.
    - Retorna ação + explicação textual.
    """
    settings = load_settings()

    closes, volumes = carregar_historico(client, symbol)
    explain: list[str] = []
    signals: dict[str, Any] = {"sentiment": sentiment}

    if closes.empty or closes.isnull().any() or len(closes) < 50:
        return Decision(
            symbol=symbol,
            action="AVOID",
            score=-1.0,
            confidence=0.1,
            explain=["Sem histórico suficiente para calcular indicadores com segurança."],
            signals=signals,
        )

    rsi_series = calcular_rsi(closes)
    rsi = float(rsi_series.iloc[-1]) if rsi_series is not None else None
    signals["rsi"] = rsi

    bb_low, bb_mid, bb_high = calcular_bollinger_bands(closes)
    price = float(closes.iloc[-1])
    signals["price"] = price
    if bb_low is not None and bb_mid is not None and bb_high is not None:
        signals["bb_low"] = float(bb_low.iloc[-1])
        signals["bb_mid"] = float(bb_mid.iloc[-1])
        signals["bb_high"] = float(bb_high.iloc[-1])

    macd, macd_signal, macd_hist = calcular_macd(closes)
    if macd is not None and macd_signal is not None and macd_hist is not None:
        signals["macd"] = float(macd.iloc[-1])
        signals["macd_signal"] = float(macd_signal.iloc[-1])
        signals["macd_hist"] = float(macd_hist.iloc[-1])

    # Pesos (configurável no futuro)
    w_rsi = float(settings.get("weights", {}).get("rsi", 0.45))
    w_bb = float(settings.get("weights", {}).get("bollinger", 0.30))
    w_macd = float(settings.get("weights", {}).get("macd", 0.15))
    w_sent = float(settings.get("weights", {}).get("sentiment", 0.10))

    score = 0.0
    confidence = 0.35

    # RSI (compra quando oversold)
    rsi_buy = float(settings.get("rsi_compra", 30))
    rsi_sell = float(settings.get("rsi_venda", 70))
    if rsi is not None:
        if rsi <= rsi_buy:
            score += w_rsi * 1.0
            confidence += 0.20
            explain.append(f"RSI {rsi:.1f} <= {rsi_buy:.0f}: sinal de possível sobrevenda (favorável a compra).")
        elif rsi >= rsi_sell:
            score -= w_rsi * 0.8
            confidence += 0.10
            explain.append(f"RSI {rsi:.1f} >= {rsi_sell:.0f}: sinal de sobrecompra (evitar entrada).")
        else:
            score += w_rsi * 0.1
            explain.append(f"RSI {rsi:.1f} em zona neutra.")

    # Bollinger (compra perto/abaixo da banda inferior)
    if "bb_low" in signals and "bb_high" in signals:
        low = signals["bb_low"]
        high = signals["bb_high"]
        if price <= low:
            score += w_bb * 1.0
            confidence += 0.15
            explain.append("Preço abaixo/na banda inferior de Bollinger: possível preço 'barato' relativo.")
        elif price >= high:
            score -= w_bb * 0.6
            confidence += 0.10
            explain.append("Preço na banda superior de Bollinger: risco de entrada tardia.")
        else:
            score += w_bb * 0.15
            explain.append("Preço dentro das bandas de Bollinger (neutro).")

    # MACD (tendência)
    if "macd_hist" in signals:
        hist = float(signals["macd_hist"])
        if hist > 0:
            score += w_macd * _clamp(hist, 0.0, 1.0)
            confidence += 0.10
            explain.append("MACD histograma positivo: tendência favorecendo alta.")
        else:
            score -= w_macd * _clamp(abs(hist), 0.0, 1.0) * 0.8
            explain.append("MACD histograma negativo: tendência desfavorável.")

    # Sentimento (NewsAPI/TextBlob) - fraco, mas ajuda no filtro
    score += w_sent * _clamp(sentiment, -1.0, 1.0)
    if sentiment > 0.15:
        explain.append(f"Sentimento de notícias positivo ({sentiment:.2f}).")
    elif sentiment < -0.15:
        explain.append(f"Sentimento de notícias negativo ({sentiment:.2f}).")
    else:
        explain.append(f"Sentimento de notícias neutro ({sentiment:.2f}).")

    score = _clamp(score, -1.0, 1.0)
    confidence = _clamp(confidence, 0.05, 0.95)

    buy_threshold = float(settings.get("buy_threshold", 0.45))
    avoid_threshold = float(settings.get("avoid_threshold", -0.20))

    if score >= buy_threshold:
        action = "BUY"
        explain.insert(0, f"Score {score:.2f} >= {buy_threshold:.2f}: comprar faz sentido dentro da estratégia.")
    elif score <= avoid_threshold:
        action = "AVOID"
        explain.insert(0, f"Score {score:.2f} <= {avoid_threshold:.2f}: evitar entrada (risco/retorno ruim).")
    else:
        action = "HOLD"
        explain.insert(0, f"Score {score:.2f} entre limites: aguardar por melhor sinal.")

    return Decision(
        symbol=symbol,
        action=action,
        score=score,
        confidence=confidence,
        explain=explain,
        signals=signals,
    )


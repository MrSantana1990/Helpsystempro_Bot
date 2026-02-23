from __future__ import annotations

import random

from .config import load_settings
from .storage import Storage, make_decision, make_trade


def generate_mock(storage: Storage, *, seed: int = 42) -> None:
    """
    Gera dados fictícios (decisões + trades simulados) para visualizar o painel local
    sem depender de chaves da Binance/Telegram.
    """
    settings = load_settings()
    rng = random.Random(int(seed))

    symbols = settings.get("moedas_monitoradas", []) or ["BTCUSDT", "ETHUSDT"]
    sentiment = rng.uniform(-0.4, 0.6)

    for sym in symbols:
        score = rng.uniform(-0.8, 0.9)
        confidence = rng.uniform(0.2, 0.9)
        buy_th = float(settings.get("buy_threshold", 0.45))
        avoid_th = float(settings.get("avoid_threshold", -0.2))
        action = "BUY" if score > buy_th else ("AVOID" if score < avoid_th else "HOLD")
        explain = [
            "Modo MOCK: este registro é fictício (apenas para visualizar o painel).",
            f"Sentimento (mock): {sentiment:.2f}",
            f"Score (mock): {score:.2f} | Confiança (mock): {confidence:.2f}",
        ]
        storage.record_decision(
            make_decision(
                symbol=sym,
                action=action,
                score=float(score),
                confidence=float(confidence),
                details={"explain": explain, "signals": {"sentiment": sentiment, "mock": True}},
            )
        )

    for sym in symbols[: min(2, len(symbols))]:
        price = rng.uniform(10, 60000)
        qty = rng.uniform(0.001, 0.05)
        storage.record_trade(
            make_trade(
                symbol=sym,
                side="BUY",
                qty=float(qty),
                price=float(price),
                quote_qty=float(qty * price),
                status="SIMULATED",
                order_id=None,
                raw={"mock": True, "seed": seed},
            )
        )


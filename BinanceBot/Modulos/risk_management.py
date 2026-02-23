from __future__ import annotations

from dataclasses import dataclass

from .config import load_settings


@dataclass(frozen=True)
class Allocation:
    usdt: float
    reason: str


def allocate_usdt(balance_usdt: float, coins_count: int) -> Allocation:
    """
    Alocação simples e segura:
    - Nunca excede `maximo_exposicao_por_ordem` do saldo.
    - Respeita `minimo_usdt_por_ordem`.
    - Evita somatório estourar saldo quando há muitas moedas.
    """
    s = load_settings()
    min_order = float(s.get("minimo_usdt_por_ordem", 5.0))
    max_exposure = float(s.get("maximo_exposicao_por_ordem", 0.25))

    coins_count = max(int(coins_count), 1)
    by_split = balance_usdt / coins_count
    by_max = balance_usdt * max_exposure
    usdt = max(min_order, min(by_split, by_max))

    if usdt > balance_usdt:
        usdt = balance_usdt
        return Allocation(usdt=usdt, reason="Saldo menor que o mínimo configurado; alocação truncada pelo saldo.")

    reason = f"min({by_split:.2f} por divisão, {by_max:.2f} por exposição) com mínimo {min_order:.2f}."
    return Allocation(usdt=usdt, reason=reason)


from __future__ import annotations

import asyncio
import logging
import time
from collections import deque

import aiohttp

from .config import load_env, load_settings

logger = logging.getLogger(__name__)

_sent_timestamps = deque(maxlen=200)


def _rate_limit_ok(now: float, per_minute: int) -> bool:
    window_start = now - 60.0
    while _sent_timestamps and _sent_timestamps[0] < window_start:
        _sent_timestamps.popleft()
    return len(_sent_timestamps) < per_minute


async def enviar_alerta(mensagem: str, tipo: str = "INFO") -> None:
    settings = load_settings()
    per_minute = int(settings.get("limite_notificacoes_por_minuto", 10))
    now = time.time()

    if not _rate_limit_ok(now, per_minute):
        logger.warning("Limite de notificações por minuto atingido; mensagem suprimida.")
        return

    env = load_env()
    if not env.telegram_api_key or not env.telegram_chat_id:
        logger.warning("Telegram não configurado (TELEGRAM_API_KEY/TELEGRAM_CHAT_ID).")
        return

    icones = {"INFO": "ℹ️", "ALERTA": "⚠️", "CRITICO": "❌"}
    prefix = icones.get(tipo.upper(), icones["INFO"])
    texto = f"{prefix} {mensagem}"

    url = f"https://api.telegram.org/bot{env.telegram_api_key}/sendMessage"
    payload = {"chat_id": env.telegram_chat_id, "text": texto}

    try:
        timeout = aiohttp.ClientTimeout(total=10)
        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.post(url, data=payload) as resp:
                if resp.status >= 300:
                    body = await resp.text()
                    logger.error("Falha ao enviar Telegram (%s): %s", resp.status, body[:500])
                    return
    except Exception as e:
        logger.error("Erro ao enviar Telegram: %s", e)
        return

    _sent_timestamps.append(now)


async def alerta_compra(symbol: str, price: float, qty: float) -> None:
    await enviar_alerta(
        f"COMPRA executada: {symbol} | preço {price:.6f} | qty {qty}",
        tipo="ALERTA",
    )


async def alerta_venda(symbol: str, price: float, qty: float, motivo: str = "") -> None:
    extra = f" | motivo: {motivo}" if motivo else ""
    await enviar_alerta(
        f"VENDA executada: {symbol} | preço {price:.6f} | qty {qty}{extra}",
        tipo="ALERTA",
    )


async def alerta_erro(msg: str) -> None:
    await enviar_alerta(msg, tipo="CRITICO")


async def alerta_pnl(pnl_usdt: float, pnl_percent: float) -> None:
    await enviar_alerta(f"PnL do ciclo: {pnl_usdt:.2f} USDT ({pnl_percent:.2f}%)", tipo="INFO")


async def sleep_no_block(seconds: float) -> None:
    # utilitário para substituir time.sleep em fluxos async
    await asyncio.sleep(seconds)


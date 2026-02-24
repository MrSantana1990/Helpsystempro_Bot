from __future__ import annotations

import argparse
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Any

import requests
from binance.client import Client

from Modulos.config import load_env, load_settings
from Modulos.decision_engine import score_symbol
from Modulos.logger import configurar_logger
from Modulos.market_data import analisar_sentimento, buscar_noticias
from Modulos.order_manager import executar_compra
from Modulos.risk_management import allocate_usdt
from Modulos.storage import Storage, make_decision
from Modulos.mock_data import generate_mock
from Modulos.notifications import enviar_alerta
from Modulos.symbol_registry import approved_symbols, propose_symbol
from Modulos.env_flags import env_flag
from Modulos.kill_switch import engage_kill_switch, read_kill_switch
from Modulos.risk_limits import evaluate_risk_limits

logger = configurar_logger()


_discover_cache: dict[str, Any] = {"ts": 0.0, "rows": []}


def _discover_usdt_symbols(*, limit: int, min_quote_volume: float) -> list[dict[str, Any]]:
    """
    Descobre pares USDT com base em ticker 24h (público).
    Retorna lista de dicts: {symbol, quoteVolume, priceChangePercent}.
    """
    now = time.time()
    if _discover_cache["rows"] and (now - float(_discover_cache["ts"] or 0.0)) < 60.0:
        return list(_discover_cache["rows"])[:limit]

    url = "https://api.binance.com/api/v3/ticker/24hr"
    try:
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.warning("Falha no discovery público (ticker/24hr): %s", e)
        return []

    stable = {"USDT", "BUSD", "USDC", "TUSD", "FDUSD", "DAI"}
    bad_suffix = ("UP", "DOWN", "BULL", "BEAR")

    rows: list[dict[str, Any]] = []
    for it in data if isinstance(data, list) else []:
        sym = str(it.get("symbol") or "").upper()
        if not sym.endswith("USDT"):
            continue
        base = sym[: -len("USDT")]
        if not base or base in stable:
            continue
        if base.endswith(bad_suffix):
            continue
        try:
            qv = float(it.get("quoteVolume") or 0.0)
            chg = float(it.get("priceChangePercent") or 0.0)
        except Exception:
            continue
        if qv < float(min_quote_volume):
            continue
        rows.append({"symbol": sym, "quoteVolume": qv, "priceChangePercent": chg})

    rows.sort(key=lambda x: float(x.get("quoteVolume") or 0.0), reverse=True)
    _discover_cache["ts"] = now
    _discover_cache["rows"] = rows
    return rows[:limit]


def _within_schedule(settings: dict, now_hour_utc: int) -> bool:
    """
    Suporta intervalos normais [start, end] e intervalos que cruzam meia-noite (ex: [23, 2]).
    """
    intervals = settings.get("horarios_estrategicos", []) or []
    for start, end in intervals:
        start = int(start)
        end = int(end)
        if start == end:
            continue
        if start < end:
            if start <= now_hour_utc < end:
                return True
        else:
            if now_hour_utc >= start or now_hour_utc < end:
                return True
    return False


def _make_binance_client(settings: dict, *, allow_public: bool) -> Client:
    env = load_env()
    if not env.api_key or not env.api_secret:
        if allow_public:
            logger.warning("API_KEY/API_SECRET ausentes. Rodando em modo análise (sem trades).")
            # Para análise usamos endpoints públicos (mainnet); testnet não é necessário sem credenciais.
            return Client(api_key=None, api_secret=None, testnet=False)
        raise ValueError("API_KEY/API_SECRET não configuradas em BinanceBot/Configs/key.env")
    testnet = bool(settings.get("testnet", True))
    if not testnet:
        # trava de segurança: evita operação real "sem querer"
        if not (
            env_flag("HSP_LIVE_TRADING", False)
            or env_flag("LIVE_MODE", False)
            or env_flag("HSP_LIVE_MODE", False)
        ):
            raise ValueError(
                "testnet=false, mas HSP_LIVE_TRADING não está habilitado. "
                "Para operar em conta real, defina HSP_LIVE_TRADING=1."
            )
    return Client(env.api_key, env.api_secret, testnet=testnet)


def _sync_binance_time(client: Client, attempts: int = 3) -> None:
    for i in range(1, attempts + 1):
        try:
            server_time = client.get_server_time()
            offset = server_time["serverTime"] - int(time.time() * 1000)
            client.timestamp_offset = offset
            logger.info("Sincronização com Binance OK. Offset=%sms", offset)
            return
        except Exception as e:
            logger.warning("Erro ao sincronizar relógio (tentativa %s/%s): %s", i, attempts, e)
            time.sleep(2)
    raise RuntimeError("Falha ao sincronizar relógio com a Binance.")


def _balance_usdt(client: Client) -> float:
    bal = client.get_asset_balance(asset="USDT")
    return float(bal["free"])


def _symbol_price(client: Client, symbol: str) -> float:
    return float(client.get_symbol_ticker(symbol=symbol)["price"])


async def _notify(text: str, level: str = "INFO") -> None:
    # Envia para Telegram, com rate limit e fallback silencioso.
    await enviar_alerta(text, tipo=level)


async def run_cycle(client: Client, storage: Storage, *, dry_run: bool) -> None:
    settings = load_settings()

    now_hour = datetime.now(timezone.utc).hour
    if not _within_schedule(settings, now_hour):
        pause = int(settings.get("intervalo_pausa", 300))
        logger.info("Fora do horário estratégico (UTC=%s). Pausando %ss...", now_hour, pause)
        await _notify(f"Fora do horário estratégico (UTC={now_hour}). Bot pausado por {pause}s.")
        await asyncio.sleep(pause)
        return

    _sync_binance_time(client)

    # Só verifica saldo/ordens se tiver credenciais (modo trade). Sem credenciais: modo análise.
    env = load_env()
    can_trade = bool(env.api_key and env.api_secret)
    balance = 0.0
    if can_trade:
        balance = _balance_usdt(client)
        logger.info("Saldo USDT (free): %.4f", balance)
        if balance < float(settings.get("minimo_usdt_por_ordem", 5.0)):
            await _notify("Saldo insuficiente para operar.", level="CRITICO")
            return
    else:
        await _notify("Modo análise: sem API_KEY/API_SECRET, não executa compras/vendas.", level="INFO")

    noticias = await buscar_noticias(settings.get("news_term", "crypto"))
    sentiment = float(analisar_sentimento(noticias))

    await _notify(f"Sentimento de notícias: {sentiment:.2f}")

    auto_symbols = [str(x).strip().upper() for x in (settings.get("moedas_monitoradas") or []) if str(x).strip()]
    if not auto_symbols:
        logger.warning("Nenhuma moeda configurada em moedas_monitoradas.")
        return

    # Descoberta (novas moedas): avalia possibilidades, mas só compra quando o usuário aprovar no painel.
    discovery_enabled = bool(settings.get("discovery_enabled", True))
    discovery_limit = int(settings.get("discovery_limit", 20))
    discovery_min_qv = float(settings.get("discovery_min_quote_volume", 5_000_000.0))
    discovery_min_score = float(settings.get("discovery_min_score", float(settings.get("buy_threshold", 0.45)) + 0.10))
    discovery_max_new_per_day = int(settings.get("discovery_max_new_per_day", 3))
    discovery_cooldown_hours = float(settings.get("discovery_cooldown_hours", 24.0))
    discovery_exclude_bases = {str(x).strip().upper() for x in (settings.get("discovery_exclude_bases") or []) if str(x).strip()}

    discovered = []
    if discovery_enabled:
        discovered = [x["symbol"] for x in _discover_usdt_symbols(limit=discovery_limit, min_quote_volume=discovery_min_qv)]

    universe = []
    seen = set()
    for s in list(auto_symbols) + list(discovered):
        s = str(s).strip().upper()
        if not s or s in seen:
            continue
        seen.add(s)
        universe.append(s)

    approved_extra = approved_symbols()
    effective_auto = set(auto_symbols) | set(approved_extra)

    decisions = []
    for symbol in universe:
        d = score_symbol(client, symbol, sentiment)
        decisions.append(d)
        storage.record_decision(
            make_decision(
                symbol=symbol,
                action=d.action,
                score=float(d.score),
                confidence=float(d.confidence),
                details={
                    "explain": d.explain,
                    "signals": d.signals,
                    "source": "auto" if symbol in set(auto_symbols) else "discovery",
                    "authorized": symbol in effective_auto,
                },
            )
        )

    # Propostas (BUY fora do allowlist): salva pendência para o usuário aprovar no painel.
    for d in decisions:
        if d.action != "BUY":
            continue
        if d.symbol in effective_auto:
            continue
        if float(d.score) < float(discovery_min_score):
            continue
        base = str(d.symbol).upper().replace("USDT", "")
        if base in discovery_exclude_bases:
            continue
        proposed = propose_symbol(
            symbol=d.symbol,
            score=float(d.score),
            confidence=float(d.confidence),
            explain=list(d.explain or []),
            signals=dict(d.signals or {}),
            source="discovery",
            max_per_day=discovery_max_new_per_day,
            cooldown_hours=discovery_cooldown_hours,
        )
        if proposed:
            await _notify(
                f"Nova oportunidade detectada: {d.symbol}. Precisa de aprovação no painel (Bot → Aprovações).",
                level="INFO",
            )

    # Seleciona BUY por score (somente autorizadas)
    candidates = [d for d in decisions if d.action == "BUY" and d.symbol in effective_auto]
    candidates.sort(key=lambda x: x.score, reverse=True)
    max_per_cycle = int(settings.get("max_moedas_por_ciclo", 3))
    candidates = candidates[: max(1, max_per_cycle)]

    # Kill switch manual/automático: impede novas compras.
    ks = read_kill_switch()
    if bool(ks.get("enabled", False)):
        logger.warning("KILL SWITCH ativo. Nenhuma compra será executada neste ciclo. Motivo: %s", ks.get("reason"))
        await _notify(f"KILL SWITCH ativo: {ks.get('reason') or 'ativo'}. Novas compras bloqueadas.", level="CRITICO")
        return

    if not candidates or not can_trade:
        logger.info("Nenhuma oportunidade de compra neste ciclo.")
        return

    # Limites de risco (Local-first): antes de abrir novas posições.
    risk = evaluate_risk_limits(storage)
    if not risk.ok_to_buy:
        engage_kill_switch(reason=risk.reason, source="auto")
        await _notify(f"KILL SWITCH (auto): {risk.reason}", level="CRITICO")
        logger.warning("Compras bloqueadas por risco: %s", risk.reason)
        return

    open_syms = storage.open_symbols()
    if open_syms:
        candidates = [d for d in candidates if d.symbol not in open_syms]
        if not candidates:
            logger.info("Oportunidades existem, mas já há posição aberta nos símbolos candidatos: %s", sorted(open_syms))
            return

    max_open = int(settings.get("max_open_positions", 3))
    if len(open_syms) >= max_open:
        logger.info("Máximo de posições abertas atingido (%s).", max_open)
        await _notify(f"Máximo de posições abertas atingido ({max_open}).", level="INFO")
        return

    allocation = allocate_usdt(balance, len(candidates))
    await _notify(f"Alocação por ordem: {allocation.usdt:.2f} USDT ({allocation.reason})")

    for d in candidates:
        price = _symbol_price(client, d.symbol)
        await executar_compra(
            client,
            d.symbol,
            allocation.usdt,
            price,
            lambda m: _notify(m, level="INFO"),
            dry_run=dry_run,
            storage=storage,
        )

async def run_mock_cycle(storage: Storage, *, seed: int = 42) -> None:
    generate_mock(storage, seed=seed)


async def run_forever(*, dry_run: bool) -> None:
    settings = load_settings()
    client = _make_binance_client(settings, allow_public=bool(dry_run))
    storage = Storage()

    interval = int(settings.get("intervalo_execucao", 30))
    logger.info("Iniciando bot. testnet=%s dry_run=%s interval=%ss", settings.get("testnet"), dry_run, interval)
    await _notify(f"Bot iniciado. testnet={settings.get('testnet')} dry_run={dry_run}")

    while True:
        try:
            await run_cycle(client, storage, dry_run=dry_run)
        except Exception as e:
            logger.exception("Erro no ciclo: %s", e)
            await _notify(f"Erro no ciclo: {e}", level="CRITICO")
            await asyncio.sleep(10)
        await asyncio.sleep(interval)


def main() -> None:
    ap = argparse.ArgumentParser(description="BinanceBot (HelpSystem padrão) - execução do bot.")
    ap.add_argument("--dry-run", action="store_true", help="Simula ordens (não envia pra Binance).")
    ap.add_argument("--once", action="store_true", help="Executa 1 ciclo e sai.")
    ap.add_argument("--mock", action="store_true", help="Gera dados fictícios no SQLite (para ver o painel).")
    ap.add_argument("--seed", type=int, default=42, help="Seed do modo --mock.")
    args = ap.parse_args()

    if args.mock:
        storage = Storage()
        asyncio.run(run_mock_cycle(storage, seed=args.seed))
        print("OK: dados MOCK gerados em data/trading.sqlite3")
        return

    if args.once:
        settings = load_settings()
        client = _make_binance_client(settings, allow_public=bool(args.dry_run))
        storage = Storage()
        asyncio.run(run_cycle(client, storage, dry_run=args.dry_run))
        return

    asyncio.run(run_forever(dry_run=args.dry_run))


if __name__ == "__main__":
    main()

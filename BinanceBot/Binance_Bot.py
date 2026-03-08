from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from typing import Any

import requests
from binance.client import Client

from Modulos.config import load_env, load_settings
from Modulos.decision_engine import score_symbol
from Modulos.event_bus import get_event_bus
from Modulos.kill_switch import engage_kill_switch, read_kill_switch
from Modulos.license import require_live_license
from Modulos.logger import configurar_logger
from Modulos.market_data import analisar_sentimento, buscar_noticias
from Modulos.mock_data import generate_mock
from Modulos.notifications import enviar_alerta
from Modulos.order_manager import executar_compra
from Modulos.paths import data_dir
from Modulos.risk_limits import evaluate_risk_limits
from Modulos.risk_management import allocate_usdt
from Modulos.storage import Storage, make_decision
from Modulos.symbol_registry import approved_symbols, propose_symbol
from Modulos.env_flags import env_flag

logger = configurar_logger()

_RUNTIME_PATH = data_dir() / "bot_runtime.json"
_discover_cache: dict[str, Any] = {"ts": 0.0, "rows": []}


def _utc_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _write_runtime(patch: dict[str, Any]) -> None:
    try:
        data_dir().mkdir(parents=True, exist_ok=True)
        current: dict[str, Any] = {}
        if _RUNTIME_PATH.exists():
            try:
                current = json.loads(_RUNTIME_PATH.read_text(encoding="utf-8", errors="replace"))
            except Exception:
                current = {}
        merged = {**current, **patch, "pid": os.getpid()}
        _RUNTIME_PATH.write_text(json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        return


def _discover_usdt_symbols(*, limit: int, min_quote_volume: float) -> list[dict[str, Any]]:
    now = time.time()
    if _discover_cache["rows"] and (now - float(_discover_cache["ts"] or 0.0)) < 60.0:
        return list(_discover_cache["rows"])[:limit]

    url = "https://api.binance.com/api/v3/ticker/24hr"
    try:
        response = requests.get(url, timeout=15)
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.warning("Falha no discovery público (ticker/24hr): %s", exc)
        return []

    stable = {"USDT", "BUSD", "USDC", "TUSD", "FDUSD", "DAI"}
    bad_suffix = ("UP", "DOWN", "BULL", "BEAR")
    rows: list[dict[str, Any]] = []

    for item in data if isinstance(data, list) else []:
        symbol = str(item.get("symbol") or "").upper()
        if not symbol.endswith("USDT"):
            continue
        base = symbol[: -len("USDT")]
        if not base or base in stable:
            continue
        if base.endswith(bad_suffix):
            continue
        try:
            quote_volume = float(item.get("quoteVolume") or 0.0)
            price_change = float(item.get("priceChangePercent") or 0.0)
        except Exception:
            continue
        if quote_volume < float(min_quote_volume):
            continue
        rows.append(
            {
                "symbol": symbol,
                "quoteVolume": quote_volume,
                "priceChangePercent": price_change,
            }
        )

    rows.sort(key=lambda row: float(row.get("quoteVolume") or 0.0), reverse=True)
    _discover_cache["ts"] = now
    _discover_cache["rows"] = rows
    return rows[:limit]


def _within_schedule(settings: dict[str, Any], now_hour_utc: int) -> bool:
    intervals = settings.get("horarios_estrategicos", []) or []
    for start, end in intervals:
        start_i = int(start)
        end_i = int(end)
        if start_i == end_i:
            continue
        if start_i < end_i:
            if start_i <= now_hour_utc < end_i:
                return True
        else:
            if now_hour_utc >= start_i or now_hour_utc < end_i:
                return True
    return False


def _make_binance_client(settings: dict[str, Any], *, allow_public: bool) -> Client:
    env = load_env()
    if not env.api_key or not env.api_secret:
        if allow_public:
            logger.warning("API_KEY/API_SECRET ausentes. Rodando em modo análise (sem trades).")
            return Client(api_key=None, api_secret=None, testnet=False)
        raise ValueError("API_KEY/API_SECRET não configuradas em BinanceBot/Configs/key.env")

    testnet = bool(settings.get("testnet", True))
    if not testnet:
        if not (
            env_flag("HSP_LIVE_TRADING", False)
            or env_flag("LIVE_MODE", False)
            or env_flag("HSP_LIVE_MODE", False)
        ):
            raise ValueError(
                "testnet=false, mas HSP_LIVE_TRADING não está habilitado. "
                "Para operar em conta real, defina HSP_LIVE_TRADING=1."
            )
        if not allow_public:
            require_live_license()
    return Client(env.api_key, env.api_secret, testnet=testnet)


def _sync_binance_time(client: Client, attempts: int = 3) -> None:
    for i in range(1, attempts + 1):
        try:
            server_time = client.get_server_time()
            offset = server_time["serverTime"] - int(time.time() * 1000)
            client.timestamp_offset = offset
            logger.info("Sincronização com Binance OK. Offset=%sms", offset)
            return
        except Exception as exc:
            logger.warning("Erro ao sincronizar relógio (tentativa %s/%s): %s", i, attempts, exc)
            time.sleep(2)
    raise RuntimeError("Falha ao sincronizar relógio com a Binance.")


def _balance_usdt(client: Client) -> float:
    balance = client.get_asset_balance(asset="USDT")
    return float(balance["free"])


def _symbol_price(client: Client, symbol: str) -> float:
    return float(client.get_symbol_ticker(symbol=symbol)["price"])


async def _notify(text: str, level: str = "INFO") -> None:
    await enviar_alerta(text, tipo=level)


async def run_cycle(client: Client, storage: Storage, *, dry_run: bool) -> None:
    cycle_start = time.time()
    bus = get_event_bus()
    bus.publish(
        "cycle.started",
        {
            "dry_run": bool(dry_run),
            "pid": os.getpid(),
        },
    )
    _write_runtime({"last_cycle_start_utc": _utc_iso(), "last_error": None})
    settings = load_settings()

    now_hour = datetime.now(timezone.utc).hour
    if not _within_schedule(settings, now_hour):
        pause = int(settings.get("intervalo_pausa", 300))
        logger.info("Fora do horário estratégico (UTC=%s). Pausando %ss...", now_hour, pause)
        bus.publish("cycle.skipped_schedule", {"hour_utc": now_hour, "pause_s": pause}, severity="warn")
        await _notify(f"Fora do horário estratégico (UTC={now_hour}). Bot pausado por {pause}s.")
        await asyncio.sleep(pause)
        _write_runtime({"last_cycle_end_utc": _utc_iso(), "last_cycle_duration_s": round(time.time() - cycle_start, 3)})
        return

    _sync_binance_time(client)

    env = load_env()
    can_trade = bool(env.api_key and env.api_secret)
    balance = 0.0
    if can_trade:
        balance = _balance_usdt(client)
        logger.info("Saldo USDT (free): %.4f", balance)
        bus.publish("wallet.balance", {"asset": "USDT", "free": balance})
        if balance < float(settings.get("minimo_usdt_por_ordem", 5.0)):
            bus.publish("cycle.blocked", {"reason": "saldo_insuficiente", "balance_usdt": balance}, severity="warn")
            await _notify("Saldo insuficiente para operar.", level="CRITICO")
            _write_runtime(
                {
                    "last_cycle_end_utc": _utc_iso(),
                    "last_cycle_duration_s": round(time.time() - cycle_start, 3),
                    "last_block_reason": "saldo_insuficiente",
                }
            )
            return
    else:
        bus.publish("cycle.analysis_only", {"reason": "missing_api_keys"}, severity="warn")
        await _notify("Modo análise: sem API_KEY/API_SECRET, não executa compras/vendas.", level="INFO")

    news_term = settings.get("news_term", "crypto")
    noticias = await buscar_noticias(news_term)
    sentiment = float(analisar_sentimento(noticias))
    bus.publish("news.sentiment", {"term": news_term, "sentiment": sentiment, "articles": len(noticias)})
    await _notify(f"Sentimento de notícias: {sentiment:.2f}")

    auto_symbols = [str(x).strip().upper() for x in (settings.get("moedas_monitoradas") or []) if str(x).strip()]
    if not auto_symbols:
        logger.warning("Nenhuma moeda configurada em moedas_monitoradas.")
        bus.publish("cycle.blocked", {"reason": "no_symbols_configured"}, severity="warn")
        _write_runtime({"last_cycle_end_utc": _utc_iso(), "last_cycle_duration_s": round(time.time() - cycle_start, 3)})
        return

    discovery_enabled = bool(settings.get("discovery_enabled", True))
    discovery_limit = int(settings.get("discovery_limit", 20))
    discovery_min_qv = float(settings.get("discovery_min_quote_volume", 5_000_000.0))
    discovery_min_score = float(settings.get("discovery_min_score", float(settings.get("buy_threshold", 0.45)) + 0.10))
    discovery_max_new_per_day = int(settings.get("discovery_max_new_per_day", 3))
    discovery_cooldown_hours = float(settings.get("discovery_cooldown_hours", 24.0))
    discovery_exclude_bases = {
        str(x).strip().upper() for x in (settings.get("discovery_exclude_bases") or []) if str(x).strip()
    }

    discovered: list[str] = []
    if discovery_enabled:
        discovered = [
            row["symbol"]
            for row in _discover_usdt_symbols(limit=discovery_limit, min_quote_volume=discovery_min_qv)
        ]
        bus.publish(
            "discovery.scan",
            {
                "enabled": True,
                "found": len(discovered),
                "limit": discovery_limit,
                "min_quote_volume": discovery_min_qv,
            },
        )

    universe: list[str] = []
    seen: set[str] = set()
    for sym in list(auto_symbols) + list(discovered):
        normalized = str(sym).strip().upper()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        universe.append(normalized)
    plan_max_symbols = int(os.getenv("HSP_PLAN_MAX_SYMBOLS") or "0")
    if plan_max_symbols > 0:
        universe = universe[:plan_max_symbols]

    approved_extra = approved_symbols()
    effective_auto = set(auto_symbols) | set(approved_extra)

    decisions = []
    for symbol in universe:
        decision = score_symbol(client, symbol, sentiment, news_rows=noticias)
        decisions.append(decision)
        bus.publish(
            "decision.created",
            {
                "symbol": symbol,
                "action": decision.action,
                "score": float(decision.score),
                "confidence": float(decision.confidence),
            },
            symbol=symbol,
        )
        storage.record_decision(
            make_decision(
                symbol=symbol,
                action=decision.action,
                score=float(decision.score),
                confidence=float(decision.confidence),
                details={
                    "explain": decision.explain,
                    "signals": decision.signals,
                    "source": "auto" if symbol in set(auto_symbols) else "discovery",
                    "authorized": symbol in effective_auto,
                },
            )
        )

    for decision in decisions:
        if decision.action != "BUY":
            continue
        if decision.symbol in effective_auto:
            continue
        if float(decision.score) < float(discovery_min_score):
            continue

        base = str(decision.symbol).upper().replace("USDT", "")
        if base in discovery_exclude_bases:
            continue

        proposed = propose_symbol(
            symbol=decision.symbol,
            score=float(decision.score),
            confidence=float(decision.confidence),
            explain=list(decision.explain or []),
            signals=dict(decision.signals or {}),
            source="discovery",
            max_per_day=discovery_max_new_per_day,
            cooldown_hours=discovery_cooldown_hours,
        )
        if proposed:
            bus.publish(
                "discovery.proposed",
                {
                    "symbol": decision.symbol,
                    "score": float(decision.score),
                    "confidence": float(decision.confidence),
                },
                symbol=decision.symbol,
                severity="warn",
            )
            await _notify(
                f"Nova oportunidade detectada: {decision.symbol}. Precisa de aprovação no painel (Bot -> Aprovações).",
                level="INFO",
            )

    candidates = [d for d in decisions if d.action == "BUY" and d.symbol in effective_auto]
    candidates.sort(key=lambda item: item.score, reverse=True)
    max_per_cycle = int(settings.get("max_moedas_por_ciclo", 3))
    candidates = candidates[: max(1, max_per_cycle)]

    ks = read_kill_switch()
    if bool(ks.get("enabled", False)):
        logger.warning("KILL SWITCH ativo. Nenhuma compra será executada neste ciclo. Motivo: %s", ks.get("reason"))
        bus.publish("cycle.blocked", {"reason": "kill_switch", "detail": ks}, severity="critical")
        await _notify(f"KILL SWITCH ativo: {ks.get('reason') or 'ativo'}. Novas compras bloqueadas.", level="CRITICO")
        _write_runtime(
            {
                "last_cycle_end_utc": _utc_iso(),
                "last_cycle_duration_s": round(time.time() - cycle_start, 3),
                "last_block_reason": "kill_switch",
            }
        )
        return

    if not candidates or not can_trade:
        logger.info("Nenhuma oportunidade de compra neste ciclo.")
        bus.publish("cycle.no_trades", {"candidates": len(candidates), "can_trade": bool(can_trade)})
        _write_runtime(
            {
                "last_cycle_end_utc": _utc_iso(),
                "last_cycle_duration_s": round(time.time() - cycle_start, 3),
                "last_block_reason": "no_candidates_or_no_trade",
            }
        )
        return

    risk = evaluate_risk_limits(storage)
    if not risk.ok_to_buy:
        engage_kill_switch(reason=risk.reason, source="auto")
        bus.publish("risk.block", {"reason": risk.reason}, severity="critical")
        await _notify(f"KILL SWITCH (auto): {risk.reason}", level="CRITICO")
        logger.warning("Compras bloqueadas por risco: %s", risk.reason)
        _write_runtime(
            {
                "last_cycle_end_utc": _utc_iso(),
                "last_cycle_duration_s": round(time.time() - cycle_start, 3),
                "last_block_reason": risk.reason,
            }
        )
        return

    open_symbols = storage.open_symbols()
    if open_symbols:
        candidates = [d for d in candidates if d.symbol not in open_symbols]
        if not candidates:
            logger.info("Oportunidades existem, mas já há posição aberta nos símbolos candidatos: %s", sorted(open_symbols))
            bus.publish(
                "cycle.blocked",
                {"reason": "open_symbols_block", "open_symbols": sorted(open_symbols)},
                severity="warn",
            )
            _write_runtime(
                {
                    "last_cycle_end_utc": _utc_iso(),
                    "last_cycle_duration_s": round(time.time() - cycle_start, 3),
                    "last_block_reason": "open_symbols_block",
                }
            )
            return

    max_open = int(settings.get("max_open_positions", 3))
    if len(open_symbols) >= max_open:
        logger.info("Máximo de posições abertas atingido (%s).", max_open)
        bus.publish("cycle.blocked", {"reason": "max_open_positions", "max_open": max_open}, severity="warn")
        await _notify(f"Máximo de posições abertas atingido ({max_open}).", level="INFO")
        _write_runtime(
            {
                "last_cycle_end_utc": _utc_iso(),
                "last_cycle_duration_s": round(time.time() - cycle_start, 3),
                "last_block_reason": "max_open_positions",
            }
        )
        return

    slots = max(0, max_open - len(open_symbols))
    candidates = candidates[:slots]

    allocation = allocate_usdt(balance, len(candidates))
    await _notify(f"Alocação por ordem: {allocation.usdt:.2f} USDT ({allocation.reason})")

    max_orders_per_day = int(risk.limits.get("risk_max_orders_per_day", 0.0) or 0)
    max_buy_quote = float(risk.limits.get("risk_max_daily_buy_quote_usdt", 0.0) or 0.0)
    max_exposure_symbol = float(settings.get("risk_max_exposure_quote_usdt_per_symbol", 0.0) or 0.0)
    min_usdt = float(settings.get("minimo_usdt_por_ordem", 5.0) or 0.0)

    planned_quote = 0.0
    placed = 0

    for decision in candidates:
        if max_orders_per_day > 0 and (int(risk.stats.orders_count) + placed) >= max_orders_per_day:
            await _notify(f"Limite de ordens/dia atingido ({max_orders_per_day}).", level="INFO")
            break

        remaining_quote = None
        if max_buy_quote > 0:
            remaining_quote = max(0.0, max_buy_quote - float(risk.stats.buy_quote_usdt) - planned_quote)
            if remaining_quote <= 0:
                await _notify(f"Limite diário de compras atingido ({max_buy_quote:.2f} USDT).", level="INFO")
                break

        order_budget = float(allocation.usdt)
        try:
            size_mult = float((decision.signals or {}).get("position_size_multiplier") or 1.0)
        except Exception:
            size_mult = 1.0
        size_mult = max(0.25, min(1.5, size_mult))
        order_budget *= size_mult

        remaining_balance = max(0.0, float(balance) - planned_quote)
        order_budget = min(order_budget, remaining_balance)

        if max_exposure_symbol > 0:
            order_budget = min(order_budget, max_exposure_symbol)
        if remaining_quote is not None:
            order_budget = min(order_budget, remaining_quote)

        if order_budget < max(0.0, min_usdt):
            logger.info(
                "Budget por ordem abaixo do mínimo (%.2f < %.2f). Pulando %s.",
                order_budget,
                min_usdt,
                decision.symbol,
            )
            bus.publish(
                "order.skipped",
                {
                    "symbol": decision.symbol,
                    "reason": "budget_below_min",
                    "budget": order_budget,
                    "minimum": min_usdt,
                },
                severity="warn",
                symbol=decision.symbol,
            )
            continue

        price = _symbol_price(client, decision.symbol)
        bus.publish(
            "order.placing",
            {
                "symbol": decision.symbol,
                "budget_usdt": float(order_budget),
                "price": float(price),
                "multiplier": size_mult,
            },
            symbol=decision.symbol,
        )
        await executar_compra(
            client,
            decision.symbol,
            order_budget,
            price,
            lambda msg: _notify(msg, level="INFO"),
            dry_run=dry_run,
            storage=storage,
        )
        placed += 1
        planned_quote += float(order_budget)
        open_symbols.add(decision.symbol)
        bus.publish(
            "order.placed",
            {"symbol": decision.symbol, "budget_usdt": float(order_budget), "placed_total": placed},
            symbol=decision.symbol,
        )
        if len(open_symbols) >= max_open:
            break

    bus.publish(
        "cycle.finished",
        {
            "duration_s": round(time.time() - cycle_start, 3),
            "planned_quote_usdt": round(planned_quote, 6),
            "orders_placed": placed,
            "candidates": [candidate.symbol for candidate in candidates],
        },
    )
    _write_runtime(
        {
            "last_cycle_end_utc": _utc_iso(),
            "last_cycle_duration_s": round(time.time() - cycle_start, 3),
            "last_cycle_candidates": [candidate.symbol for candidate in candidates],
            "last_cycle_buys_planned_usdt": round(planned_quote, 6),
            "last_block_reason": None,
        }
    )


async def run_mock_cycle(storage: Storage, *, seed: int = 42) -> None:
    generate_mock(storage, seed=seed)


async def run_forever(*, dry_run: bool) -> None:
    settings = load_settings()
    client = _make_binance_client(settings, allow_public=bool(dry_run))
    storage = Storage()
    bus = get_event_bus()

    interval = int(settings.get("intervalo_execucao", 30))
    logger.info("Iniciando bot. testnet=%s dry_run=%s interval=%ss", settings.get("testnet"), dry_run, interval)
    bus.publish(
        "bot.started",
        {
            "testnet": bool(settings.get("testnet", True)),
            "dry_run": bool(dry_run),
            "interval_s": interval,
        },
    )
    await _notify(f"Bot iniciado. testnet={settings.get('testnet')} dry_run={dry_run}")

    try:
        while True:
            try:
                await run_cycle(client, storage, dry_run=dry_run)
            except Exception as exc:
                logger.exception("Erro no ciclo: %s", exc)
                msg = str(exc)
                bus.publish("cycle.error", {"error": msg}, severity="critical")
                _write_runtime({"last_error": msg, "last_error_at_utc": _utc_iso()})
                await _notify(f"Erro no ciclo: {msg}", level="CRITICO")
                msg_l = msg.lower()
                if any(term in msg_l for term in ("connection", "timed out", "binance", "network", "api")):
                    await _notify("Falha de conexão com exchange/API detectada. Verifique rede e credenciais.", level="CRITICO")
                await asyncio.sleep(10)
            await asyncio.sleep(interval)
    finally:
        bus.publish("bot.stopped", {"dry_run": bool(dry_run), "pid": os.getpid()}, severity="critical")
        _write_runtime({"last_error": "bot_stopped", "last_error_at_utc": _utc_iso()})
        await _notify("Bot interrompido. Verifique processo/infra e reinicie para retomar.", level="CRITICO")


def main() -> None:
    parser = argparse.ArgumentParser(description="BinanceBot (HelpSystem padrão) - execução do bot.")
    parser.add_argument("--dry-run", action="store_true", help="Simula ordens (não envia pra Binance).")
    parser.add_argument("--once", action="store_true", help="Executa 1 ciclo e sai.")
    parser.add_argument("--mock", action="store_true", help="Gera dados fictícios no SQLite (para ver o painel).")
    parser.add_argument("--seed", type=int, default=42, help="Seed do modo --mock.")
    args = parser.parse_args()

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

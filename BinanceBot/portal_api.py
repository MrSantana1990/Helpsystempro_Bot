from __future__ import annotations

import os
import time
import json
import subprocess
import sys
import platform
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse

from BinanceBot.Modulos.mock_data import generate_mock
from BinanceBot.Modulos.paths import logs_dir
from BinanceBot.Modulos.storage import Storage
from BinanceBot.Modulos.config import load_env, load_settings
from BinanceBot.Modulos.paths import config_dir
from BinanceBot.Modulos.symbol_registry import decide_symbol, load_registry, registry_path
from BinanceBot.Modulos.env_flags import env_flag, get_runtime_flags
from BinanceBot.Modulos.audit_log import append_audit_event, audit_path
from BinanceBot.Modulos.kill_switch import clear_kill_switch, engage_kill_switch, read_kill_switch
from BinanceBot.Modulos.risk_limits import compute_daily_risk_stats, evaluate_risk_limits


REPO_DIR = Path(__file__).resolve().parents[1]
PORTAL_DIR = REPO_DIR / "portal"
DATA_DIR = REPO_DIR / "data"


app = FastAPI(title="HelpSystem Portal API", version="1.0")

_BINANCE_BASE = "https://api.binance.com"
_cache: dict[str, tuple[float, Any]] = {}

_BOT_PID_PATH = DATA_DIR / "bot.pid"
_BOT_STATE_PATH = DATA_DIR / "bot_state.json"

_ENV_KEYS_ORDERED = [
    "API_KEY",
    "API_SECRET",
    "NEWS_API_KEY",
    "TELEGRAM_API_KEY",
    "TELEGRAM_CHAT_ID",
    "GITHUB_TOKEN",
]

_PORTFOLIO_PATH = DATA_DIR / "portfolio.json"


def _request_token(request: Request) -> str | None:
    try:
        qp = request.query_params.get("token")
        if qp:
            return str(qp)
    except Exception:
        pass
    try:
        auth = request.headers.get("authorization") or ""
        if auth.lower().startswith("bearer "):
            v = auth[7:].strip()
            return v or None
    except Exception:
        pass
    return None


@app.middleware("http")
async def local_first_guard(request: Request, call_next):  # type: ignore[no-untyped-def]
    flags = get_runtime_flags()

    # Local-first: bloqueia acesso remoto por padrÃ£o.
    if bool(flags.get("local_only", True)):
        host = request.client.host if request.client else ""
        if host not in {"127.0.0.1", "::1"}:
            return JSONResponse(status_code=403, content={"detail": "Acesso remoto desativado (Local-first)."})

    # Opcional: auth global (para futura VPS dedicada).
    if bool(flags.get("enable_auth", False)) and request.url.path.startswith("/api/"):
        # MantÃ©m health pÃºblico para smoke test local.
        if request.url.path == "/api/health":
            return await call_next(request)
        expected = os.getenv("HSP_PORTAL_TOKEN") or ""
        token = _request_token(request)
        if not expected or token != expected:
            return JSONResponse(status_code=403, content={"detail": "Token invÃ¡lido."})

    return await call_next(request)


def _parse_env_text(env_text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw_line in (env_text or "").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if k in _ENV_KEYS_ORDERED and v:
            out[k] = v
    return out


def _validate_settings_payload(payload: dict[str, Any]) -> None:
    # Validação leve: confere tipos das chaves críticas, mas permite campos extras.
    def _ensure(name: str, types: tuple[type, ...]) -> None:
        if name not in payload:
            return
        if not isinstance(payload[name], types):
            exp = " ou ".join([t.__name__ for t in types])
            raise HTTPException(status_code=400, detail=f"Campo inválido: {name} (esperado {exp}).")

    _ensure("testnet", (bool,))
    _ensure("monitoramento_ativo", (bool,))
    _ensure("ia_ativa", (bool,))
    _ensure("intervalo_execucao", (int, float))
    _ensure("intervalo_pausa", (int, float))
    _ensure("minimo_usdt_por_ordem", (int, float))
    _ensure("max_moedas_por_ciclo", (int, float))
    _ensure("max_open_positions", (int, float))
    _ensure("buy_threshold", (int, float))
    _ensure("avoid_threshold", (int, float))
    _ensure("stop_loss_percentual", (int, float))
    _ensure("take_profit_percentual", (int, float))
    _ensure("risk_max_daily_buy_quote_usdt", (int, float))
    _ensure("risk_max_daily_loss_usdt", (int, float))
    if "moedas_monitoradas" in payload and not isinstance(payload["moedas_monitoradas"], list):
        raise HTTPException(status_code=400, detail="Campo inválido: moedas_monitoradas (esperado lista).")


def _public_price(symbol: str) -> float | None:
    sym = (symbol or "").strip().upper()
    if not sym:
        return None
    cache_key = f"price:{sym}"
    cached = _cache_get(cache_key, ttl_s=8.0)
    if cached is not None:
        return cached

    url = f"{_BINANCE_BASE}/api/v3/ticker/price"
    try:
        r = requests.get(url, params={"symbol": sym}, timeout=10)
        if r.status_code >= 400:
            return None
        data = r.json()
        price = float(data.get("price", 0) or 0)
        if price <= 0:
            return None
        _cache_set(cache_key, price)
        return price
    except Exception:
        return None


def _read_portfolio() -> list[dict[str, Any]]:
    try:
        if not _PORTFOLIO_PATH.exists():
            return []
        raw = json.loads(_PORTFOLIO_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, list):
            return []
        out: list[dict[str, Any]] = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            asset = str(item.get("asset") or "").strip().upper()
            qty = float(item.get("qty") or 0.0)
            if not asset or qty <= 0:
                continue
            out.append({"asset": asset, "qty": qty})
        return out
    except Exception:
        return []


def _write_portfolio(items: list[dict[str, Any]]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _PORTFOLIO_PATH.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")


def _cache_get(key: str, ttl_s: float) -> Any | None:
    now = time.time()
    v = _cache.get(key)
    if not v:
        return None
    ts, data = v
    if now - ts > ttl_s:
        return None
    return data


def _cache_set(key: str, data: Any) -> None:
    _cache[key] = (time.time(), data)


def _require_token(token: str | None) -> None:
    expected = os.getenv("HSP_PORTAL_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=403,
            detail="Escrita de config desativada. Defina HSP_PORTAL_TOKEN e reinicie o servidor.",
        )
    if token != expected:
        raise HTTPException(status_code=403, detail="Token inválido.")


def _is_windows() -> bool:
    return platform.system().lower().startswith("win")


def _pid_running(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        if _is_windows():
            # tasklist /FI "PID eq 1234" /FO CSV /NH
            r = subprocess.run(
                ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
                capture_output=True,
                text=True,
                check=False,
            )
            out = (r.stdout or "").strip()
            return out and str(pid) in out
        os.kill(pid, 0)
        return True
    except Exception:
        return False


def _read_pid() -> int | None:
    try:
        if not _BOT_PID_PATH.exists():
            return None
        pid = int(_BOT_PID_PATH.read_text(encoding="utf-8").strip())
        return pid
    except Exception:
        return None


def _write_pid(pid: int) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _BOT_PID_PATH.write_text(str(int(pid)), encoding="utf-8")


def _clear_pid() -> None:
    try:
        _BOT_PID_PATH.unlink(missing_ok=True)  # type: ignore[arg-type]
    except Exception:
        pass


def _read_state() -> dict[str, Any]:
    try:
        if not _BOT_STATE_PATH.exists():
            return {}
        return json.loads(_BOT_STATE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_state(state: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    _BOT_STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")


def _bot_status() -> dict[str, Any]:
    pid = _read_pid()
    state = _read_state()
    running = bool(pid and _pid_running(pid))
    if pid and not running:
        # limpou processo antigo
        _clear_pid()
        state = {**state, "running": False}
        _write_state(state)
    return {
        "running": running,
        "pid": pid if running else None,
        "state": state,
    }


def _bot_start(*, dry_run: bool, once: bool) -> dict[str, Any]:
    cur = _bot_status()
    if cur["running"]:
        return cur

    # bot roda como processo separado
    bot_path = REPO_DIR / "BinanceBot" / "Binance_Bot.py"
    args = [sys.executable, str(bot_path)]
    if dry_run:
        args.append("--dry-run")
    if once:
        args.append("--once")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    creationflags = 0
    if _is_windows():
        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)

    p = subprocess.Popen(
        args,
        cwd=str(REPO_DIR),
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=creationflags,
    )
    _write_pid(int(p.pid))
    state = {
        "started_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "args": args[1:],
        "dry_run": dry_run,
        "once": once,
    }
    _write_state(state)
    return _bot_status()


def _bot_stop() -> dict[str, Any]:
    pid = _read_pid()
    if not pid:
        return _bot_status()
    if _is_windows():
        subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], check=False, capture_output=True)
    else:
        try:
            os.kill(pid, 15)
        except Exception:
            pass
    _clear_pid()
    state = _read_state()
    state["stopped_at_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    _write_state(state)
    return _bot_status()


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {"ok": True}


@app.post("/api/mock")
def mock(seed: int = 42) -> dict[str, Any]:
    storage = Storage()
    generate_mock(storage, seed=int(seed))
    return {"ok": True, "db_path": str(storage.db_path)}


@app.get("/api/settings")
def settings() -> dict[str, Any]:
    return load_settings()


@app.get("/api/overview")
def overview() -> dict[str, Any]:
    storage = Storage()
    s = load_settings()
    # Evita queries gigantes: DataFrame com LIMIT pequeno
    dec = storage.decisions_df(limit=1)
    trd = storage.trades_df(limit=1)
    # Contagem "barata": usa SQL direto via DataFrame count em LIMIT alto seria pesado.
    # Para simplicidade, contamos aproximando via SELECT COUNT(*).
    with storage._connect() as con:  # noqa: SLF001 (interno, mas ok para API local)
        dec_count = int(con.execute("SELECT COUNT(*) FROM decisions").fetchone()[0])
        trd_count = int(con.execute("SELECT COUNT(*) FROM trades").fetchone()[0])
    return {
        "testnet": bool(s.get("testnet", True)),
        "db_path": str(storage.db_path),
        "counts": {
            "decisions": dec_count,
            "trades": trd_count,
            "open_positions": len(storage.open_symbols()),
        },
        "latest": {
            "decision_ts": None if dec.empty else str(dec.iloc[0]["ts_utc"]),
            "trade_ts": None if trd.empty else str(trd.iloc[0]["ts_utc"]),
        },
        "symbols": s.get("moedas_monitoradas", []) or [],
    }


@app.get("/api/trades")
def trades(limit: int = Query(200, ge=1, le=5000)) -> dict[str, Any]:
    storage = Storage()
    df = storage.trades_df(limit=int(limit))
    return {"rows": df.to_dict(orient="records")}


@app.get("/api/decisions")
def decisions(limit: int = Query(200, ge=1, le=5000)) -> dict[str, Any]:
    storage = Storage()
    df = storage.decisions_df(limit=int(limit))
    return {"rows": df.to_dict(orient="records")}


@app.get("/api/logs")
def logs(lines: int = Query(300, ge=10, le=5000)) -> dict[str, Any]:
    log_path = logs_dir() / "trading_bot.log"
    if not log_path.exists():
        return {"path": str(log_path), "lines": []}
    content = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"path": str(log_path), "lines": content[-int(lines) :]}

@app.get("/api/bot/status")
def bot_status() -> dict[str, Any]:
    return {**_bot_status(), "kill_switch": read_kill_switch(), "flags": get_runtime_flags()}


@app.post("/api/bot/start")
def bot_start(
    request: Request,
    token: str | None = None,
    dry_run: bool = True,
    once: bool = False,
) -> dict[str, Any]:
    # segurança: exige token para start/stop
    _require_token(token)
    if bool(read_kill_switch().get("enabled", False)):
        raise HTTPException(status_code=409, detail="KILL SWITCH ativo. Desative no painel para iniciar o bot.")
    # preflight: evita "parece que iniciou" mas o bot cai por config faltante
    env = load_env()
    missing: list[str] = []
    if not env.api_key:
        missing.append("API_KEY")
    if not env.api_secret:
        missing.append("API_SECRET")
    if missing:
        # Em dry-run, permitimos iniciar em modo análise (sem trades) para o usuário ver decisões/sugestões.
        if not bool(dry_run):
            raise HTTPException(
                status_code=400,
                detail="Config incompleta: faltando "
                + ", ".join(missing)
                + ". Vá em Configurações → Passo 1 (key.env) e salve.",
            )

    settings = load_settings()
    if not bool(settings.get("testnet", True)):
        if not (env_flag("HSP_LIVE_TRADING", False) or env_flag("LIVE_MODE", False) or env_flag("HSP_LIVE_MODE", False)):
            raise HTTPException(
                status_code=400,
                detail="Segurança: settings.yml está com testnet=false, mas HSP_LIVE_TRADING não está habilitado. "
                "Para operar em conta real, defina HSP_LIVE_TRADING=1 e reinicie.",
            )
        # limites obrigatórios em live
        max_buy_quote = float(settings.get("risk_max_daily_buy_quote_usdt", 0.0) or 0.0)
        max_daily_loss = float(settings.get("risk_max_daily_loss_usdt", 0.0) or 0.0)
        if max_buy_quote <= 0 or max_daily_loss <= 0:
            raise HTTPException(
                status_code=400,
                detail="Segurança: em LIVE (testnet=false), defina risk_max_daily_buy_quote_usdt e risk_max_daily_loss_usdt em settings.yml.",
            )
    append_audit_event(
        event="bot.start",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"dry_run": bool(dry_run), "once": bool(once), "testnet": bool(settings.get("testnet", True))},
    )
    return _bot_start(dry_run=bool(dry_run), once=bool(once))


@app.post("/api/bot/stop")
def bot_stop(request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(token)
    append_audit_event(
        event="bot.stop",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={},
    )
    return _bot_stop()


@app.get("/api/bot/kill_switch")
def bot_kill_switch() -> dict[str, Any]:
    return {"state": read_kill_switch(), "path": str(DATA_DIR / "kill_switch.json")}


@app.post("/api/bot/kill_switch")
def bot_kill_switch_set(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(token)
    enabled = bool(payload.get("enabled", True))
    reason = str(payload.get("reason") or "").strip() or "manual"
    if enabled:
        st = engage_kill_switch(reason=reason, source="manual")
        append_audit_event(
            event="kill_switch.engage",
            token=token,
            client_host=(request.client.host if request.client else None),
            detail={"reason": reason},
        )
    else:
        st = clear_kill_switch(source="manual")
        append_audit_event(
            event="kill_switch.clear",
            token=token,
            client_host=(request.client.host if request.client else None),
            detail={},
        )
    return {"ok": True, "state": st}


@app.get("/api/risk/daily")
def risk_daily() -> dict[str, Any]:
    storage = Storage()
    stats = compute_daily_risk_stats(storage)
    decision = evaluate_risk_limits(storage)
    return {
        "stats": {
            "day_utc": stats.day_utc,
            "buy_quote_usdt": stats.buy_quote_usdt,
            "sell_quote_usdt": stats.sell_quote_usdt,
            "realized_pnl_usdt": stats.realized_pnl_usdt,
            "trades_count": stats.trades_count,
        },
        "limits": decision.limits,
        "ok_to_buy": decision.ok_to_buy,
        "reason": decision.reason,
    }


@app.post("/api/bot/recommend_topup")
def recommend_topup(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Recomenda um aporte (R$ 10/20/50) baseado em mínimos/config.
    Não garante ganho: é apenas cálculo de viabilidade (mínimo por ordem + buffer).
    """
    settings = load_settings()
    min_usdt = float(settings.get("minimo_usdt_por_ordem", 5.0))
    max_coins = int(settings.get("max_moedas_por_ciclo", 3))
    buffer = float(settings.get("topup_buffer_percent", 10.0)) / 100.0

    cur_usdt = float(payload.get("current_usdt") or 0.0)
    cur_brl = float(payload.get("current_brl") or 0.0)

    fx = usdtbrl()
    usdt_brl = float(fx.get("price") or 0.0) or 0.0
    if usdt_brl > 0 and cur_usdt <= 0 and cur_brl > 0:
        cur_usdt = cur_brl / usdt_brl

    target_usdt = min_usdt * max(1, max_coins)
    target_usdt *= (1.0 + buffer)
    need_usdt = max(0.0, target_usdt - cur_usdt)
    need_brl = need_usdt * usdt_brl if usdt_brl > 0 else None

    options = [10, 20, 50]
    suggestion = None
    if need_brl is not None:
        for opt in options:
            if opt >= need_brl:
                suggestion = opt
                break
        suggestion = suggestion or (50 if need_brl <= 50 else None)

    return {
        "current_usdt": cur_usdt,
        "usdtbrl": usdt_brl,
        "target_usdt": target_usdt,
        "need_usdt": need_usdt,
        "need_brl": need_brl,
        "suggestion_brl": suggestion,
        "note": "Isso não é garantia de lucro. É só uma recomendação de aporte para viabilizar ordens e reduzir erros de mínimo.",
    }


@app.get("/api/market/tickers")
def market_tickers(symbols: str = Query("BTCUSDT,ETHUSDT,BNBUSDT,SOLUSDT,XRPUSDT,DOGEUSDT")) -> dict[str, Any]:
    """
    Retorna ticker 24h do Binance Spot (público).
    """
    syms = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    syms = syms[:30]
    if not syms:
        return {"rows": []}

    cache_key = "tickers:" + ",".join(syms)
    cached = _cache_get(cache_key, ttl_s=3.0)
    if cached is not None:
        return {"rows": cached, "cached": True}

    url = f"{_BINANCE_BASE}/api/v3/ticker/24hr"
    params = {"symbols": json.dumps(syms, separators=(",", ":"))}
    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        rows = []
        for item in data:
            rows.append(
                {
                    "symbol": item.get("symbol"),
                    "lastPrice": float(item.get("lastPrice", 0) or 0),
                    "priceChangePercent": float(item.get("priceChangePercent", 0) or 0),
                    "quoteVolume": float(item.get("quoteVolume", 0) or 0),
                    "highPrice": float(item.get("highPrice", 0) or 0),
                    "lowPrice": float(item.get("lowPrice", 0) or 0),
                }
            )
        _cache_set(cache_key, rows)
        return {"rows": rows, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao buscar Binance tickers: {e}")


@app.get("/api/market/usdtbrl")
def usdtbrl() -> dict[str, Any]:
    """
    Usa o par USDTBRL como proxy de USD/BRL (aprox).
    """
    cache_key = "usdtbrl"
    cached = _cache_get(cache_key, ttl_s=10.0)
    if cached is not None:
        return cached

    url = f"{_BINANCE_BASE}/api/v3/ticker/price"
    try:
        r = requests.get(url, params={"symbol": "USDTBRL"}, timeout=10)
        r.raise_for_status()
        data = r.json()
        out = {"symbol": "USDTBRL", "price": float(data.get("price", 0) or 0)}
        _cache_set(cache_key, out)
        return out
    except Exception:
        # fallback: se o par não existir, retorna 0 e o front lida com isso
        return {"symbol": "USDTBRL", "price": 0.0}


@app.get("/api/portfolio")
def portfolio() -> dict[str, Any]:
    return {"rows": _read_portfolio(), "path": str(_PORTFOLIO_PATH)}


@app.post("/api/portfolio/save")
def portfolio_save(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(token)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido.")
    rows = payload.get("rows")
    if not isinstance(rows, list):
        raise HTTPException(status_code=400, detail="Payload inválido: esperado rows (lista).")
    cleaned: list[dict[str, Any]] = []
    for item in rows:
        if not isinstance(item, dict):
            continue
        asset = str(item.get("asset") or "").strip().upper()
        qty = float(item.get("qty") or 0.0)
        if not asset or qty <= 0:
            continue
        cleaned.append({"asset": asset, "qty": qty})
    _write_portfolio(cleaned)
    append_audit_event(
        event="portfolio.save",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"rows_count": len(cleaned), "assets": [r.get("asset") for r in cleaned][:40]},
    )
    return {"ok": True, "rows": cleaned, "path": str(_PORTFOLIO_PATH)}


@app.get("/api/account/summary")
def account_summary() -> dict[str, Any]:
    """
    Resumo da carteira da Binance (requer API_KEY/API_SECRET).
    Se não houver chave configurada, retorna enabled=false.
    """
    cache_key = "account:summary"
    cached = _cache_get(cache_key, ttl_s=5.0)
    if cached is not None:
        return cached

    env = load_env()
    if not env.api_key or not env.api_secret:
        out = {
            "enabled": False,
            "message": "Binance API não configurada (API_KEY/API_SECRET). Para mostrar sua carteira real, salve as chaves em Configurações → Passo 1.",
        }
        _cache_set(cache_key, out)
        return out

    settings = load_settings()
    testnet = bool(settings.get("testnet", True))

    try:
        from binance.client import Client  # type: ignore

        client = Client(env.api_key, env.api_secret, testnet=testnet)
        acct = client.get_account()
        balances = acct.get("balances") or []
    except Exception as e:
        out = {"enabled": False, "message": f"Falha ao ler conta Binance: {e}"}
        _cache_set(cache_key, out)
        return out

    fx = usdtbrl()
    usdt_brl = float(fx.get("price") or 0.0) or 0.0

    holdings: list[dict[str, Any]] = []
    total_usdt = 0.0
    available_usdt = 0.0
    for b in balances:
        try:
            asset = str(b.get("asset") or "").strip().upper()
            free = float(b.get("free") or 0.0)
            locked = float(b.get("locked") or 0.0)
            qty = free + locked
            if not asset or qty <= 0:
                continue
            if qty < 1e-12:
                continue

            item: dict[str, Any] = {
                "asset": asset,
                "free": free,
                "locked": locked,
                "qty": qty,
            }
            if asset == "USDT":
                available_usdt = max(available_usdt, free)
                item["price_usdt"] = 1.0
                item["value_usdt"] = qty
                total_usdt += qty
            else:
                px = _public_price(f"{asset}USDT")
                if px is not None:
                    item["price_usdt"] = px
                    item["value_usdt"] = qty * px
                    total_usdt += float(item["value_usdt"])
                else:
                    item["price_usdt"] = None
                    item["value_usdt"] = None
                    item["unvalued_reason"] = "Sem par direto {ASSET}USDT (ou indisponível)."

            holdings.append(item)
        except Exception:
            continue

    holdings.sort(key=lambda x: float(x.get("value_usdt") or 0.0), reverse=True)
    total_brl = total_usdt * usdt_brl if usdt_brl > 0 else None
    available_brl = available_usdt * usdt_brl if usdt_brl > 0 else None

    out = {
        "enabled": True,
        "testnet": testnet,
        "fx": fx,
        "rows": holdings,
        "total_usdt": total_usdt,
        "total_brl": total_brl,
        "available_usdt": available_usdt,
        "available_brl": available_brl,
        "note": "Valores são estimativas (conversão via pares USDT e USDTBRL).",
    }
    _cache_set(cache_key, out)
    return out


@app.get("/api/market/klines")
def klines(
    symbol: str = Query("BTCUSDT"),
    interval: str = Query("15m"),
    limit: int = Query(96, ge=10, le=1000),
) -> dict[str, Any]:
    """
    Klines (candles) públicos do Binance Spot.
    Retorna closes para gráfico simples no portal.
    """
    sym = symbol.strip().upper()
    itv = interval.strip()
    cache_key = f"klines:{sym}:{itv}:{limit}"
    cached = _cache_get(cache_key, ttl_s=8.0)
    if cached is not None:
        return {"symbol": sym, "interval": itv, "closes": cached, "cached": True}

    url = f"{_BINANCE_BASE}/api/v3/klines"
    try:
        r = requests.get(url, params={"symbol": sym, "interval": itv, "limit": int(limit)}, timeout=10)
        r.raise_for_status()
        data = r.json()
        closes = [float(x[4]) for x in data if len(x) > 4]
        _cache_set(cache_key, closes)
        return {"symbol": sym, "interval": itv, "closes": closes, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao buscar klines: {e}")


@app.get("/api/news")
def news(term: str = Query("crypto"), limit: int = Query(12, ge=1, le=50)) -> dict[str, Any]:
    """
    Notícias simplificadas (NewsAPI). Requer NEWS_API_KEY em BinanceBot/Configs/key.env.
    """
    from BinanceBot.Modulos.config import load_env
    from textblob import TextBlob

    api_key = load_env().news_api_key
    if not api_key:
        return {
            "enabled": False,
            "message": "NEWS_API_KEY não configurada. Vá em Configuração > Passo 2 e salve.",
            "rows": [],
        }

    cache_key = f"news:{term}:{limit}"
    cached = _cache_get(cache_key, ttl_s=30.0)
    if cached is not None:
        return {"enabled": True, "rows": cached, "cached": True}

    url = "https://newsapi.org/v2/everything"
    try:
        r = requests.get(
            url,
            params={"q": term, "language": "pt", "pageSize": int(limit), "apiKey": api_key},
            timeout=10,
        )
        r.raise_for_status()
        data = r.json() or {}
        articles = data.get("articles", []) or []
        rows = []
        sentiments = []
        for a in articles:
            title = (a.get("title") or "").strip()
            desc = (a.get("description") or "").strip()
            text = (title + " " + desc).strip()
            pol = float(TextBlob(text).sentiment.polarity) if text else 0.0
            sentiments.append(pol)
            cls = "positivo" if pol > 0.1 else ("negativo" if pol < -0.1 else "neutro")
            rows.append(
                {
                    "title": title,
                    "description": desc,
                    "url": a.get("url"),
                    "publishedAt": a.get("publishedAt"),
                    "source": (a.get("source") or {}).get("name"),
                    "sentiment": pol,
                    "class": cls,
                }
            )
        avg = sum(sentiments) / len(sentiments) if sentiments else 0.0
        _cache_set(cache_key, rows)
        return {"enabled": True, "term": term, "avg_sentiment": avg, "rows": rows, "cached": False}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Falha ao buscar notícias: {e}")


@app.get("/api/config/status")
def config_status() -> dict[str, Any]:
    settings = load_settings()
    env_path = config_dir() / "key.env"
    env_exists = env_path.exists()
    env_text = env_path.read_text(encoding="utf-8", errors="replace") if env_exists else ""
    env_values = _parse_env_text(env_text)

    return {
        "settings_path": str(config_dir() / "settings.yml"),
        "env_path": str(env_path),
        "audit_path": audit_path(),
        "kill_switch_path": str(DATA_DIR / "kill_switch.json"),
        "env_exists": env_exists,
        "env_present": {
            "API_KEY": bool(env_values.get("API_KEY")),
            "API_SECRET": bool(env_values.get("API_SECRET")),
            "NEWS_API_KEY": bool(env_values.get("NEWS_API_KEY")),
            "TELEGRAM_API_KEY": bool(env_values.get("TELEGRAM_API_KEY")),
            "TELEGRAM_CHAT_ID": bool(env_values.get("TELEGRAM_CHAT_ID")),
        },
        "settings": settings,
        "write_enabled": bool(os.getenv("HSP_PORTAL_TOKEN")),
        "flags": get_runtime_flags(),
    }


@app.get("/api/symbols/registry")
def symbols_registry() -> dict[str, Any]:
    settings = load_settings()
    auto = [str(x).strip().upper() for x in (settings.get("moedas_monitoradas") or []) if str(x).strip()]
    reg = load_registry()
    approved_items = reg.get("approved") or []
    approved_symbols_only = []
    for a in approved_items:
        if isinstance(a, str):
            if a.strip():
                approved_symbols_only.append(a.strip().upper())
        elif isinstance(a, dict):
            sym = str(a.get("symbol") or "").strip().upper()
            if sym:
                approved_symbols_only.append(sym)
    rejected = [str(x).strip().upper() for x in (reg.get("rejected") or []) if str(x).strip()]
    pending = reg.get("pending") or []
    effective = sorted(set(auto) | set(approved_symbols_only))
    return {
        "auto_symbols": auto,
        "approved": approved_items,
        "approved_symbols": approved_symbols_only,
        "rejected_symbols": rejected,
        "pending": pending,
        "effective_symbols": effective,
        "path": str(registry_path()),
    }


@app.post("/api/symbols/decide")
def symbols_decide(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(token)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido.")
    symbol = str(payload.get("symbol") or "").strip().upper()
    decision = str(payload.get("decision") or "").strip().lower()
    ttl_hours = payload.get("ttl_hours")
    permanent = bool(payload.get("permanent", False))
    r = decide_symbol(symbol=symbol, decision=decision, ttl_hours=ttl_hours, permanent=permanent)
    if not r.get("ok"):
        raise HTTPException(status_code=400, detail=f"Falha ao decidir: {r.get('error')}")
    append_audit_event(
        event="symbols.decide",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"symbol": symbol, "decision": decision, "permanent": permanent, "ttl_hours": ttl_hours},
    )
    return r


@app.post("/api/config/save_settings")
def save_settings(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(token)
    path = config_dir() / "settings.yml"
    # valida básico
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido.")

    _validate_settings_payload(payload)

    import yaml

    path.write_text(yaml.safe_dump(payload, sort_keys=False, allow_unicode=True), encoding="utf-8")
    try:
        load_settings.cache_clear()  # type: ignore[attr-defined]
    except Exception:
        pass
    append_audit_event(
        event="config.save_settings",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"path": str(path), "keys_count": len(payload.keys())},
    )
    return {"ok": True, "path": str(path)}


@app.post("/api/config/save_env")
def save_env(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(token)
    path = config_dir() / "key.env"
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido.")

    # Merge: não sobrescreve chaves existentes com string vazia.
    existing_text = path.read_text(encoding="utf-8", errors="replace") if path.exists() else ""
    current = _parse_env_text(existing_text)

    written: list[str] = []
    ignored_blank: list[str] = []
    for k in _ENV_KEYS_ORDERED:
        if k not in payload:
            continue
        raw = payload.get(k)
        if raw is None:
            continue
        v = str(raw).strip()
        if not v:
            ignored_blank.append(k)
            continue
        current[k] = v
        written.append(k)

    # Reescreve apenas valores não vazios (remove entradas em branco antigas).
    lines = [f"{k}={current[k]}" for k in _ENV_KEYS_ORDERED if current.get(k)]
    path.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")

    try:
        load_env.cache_clear()  # type: ignore[attr-defined]
    except Exception:
        pass
    append_audit_event(
        event="config.save_env",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"path": str(path), "saved": written, "ignored_blank": ignored_blank},
    )
    return {"ok": True, "path": str(path), "saved": written, "ignored_blank": ignored_blank}


def _safe_portal_path(full_path: str) -> Path:
    # SPA: se não existir arquivo, cai no index.html
    full_path = (full_path or "").lstrip("/")
    if full_path in {"", "/"}:
        full_path = "index.html"

    # bloqueia traversal
    if ".." in full_path or "\\" in full_path:
        raise HTTPException(status_code=400, detail="Bad path")

    target = (PORTAL_DIR / full_path).resolve()
    if PORTAL_DIR not in target.parents and target != PORTAL_DIR:
        raise HTTPException(status_code=400, detail="Bad path")
    if target.is_dir():
        target = target / "index.html"
    if not target.exists():
        target = (PORTAL_DIR / "index.html").resolve()
    return target


@app.get("/{full_path:path}")
def portal(full_path: str) -> FileResponse:
    path = _safe_portal_path(full_path)
    return FileResponse(path)

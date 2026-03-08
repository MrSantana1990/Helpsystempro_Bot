from __future__ import annotations

import csv
import io
import os
import time
import json
import socket
import subprocess
import sys
import platform
from uuid import uuid4
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import requests
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse

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
from BinanceBot.Modulos.pnl import compute_realized_fifo, expand_executions, load_trades
from BinanceBot.Modulos.license import get_license_status, save_license_obj
from BinanceBot.Modulos.event_bus import events_path, get_event_bus


REPO_DIR = Path(__file__).resolve().parents[1]
PORTAL_DIR = REPO_DIR / "portal"
DATA_DIR = REPO_DIR / "data"
COMPLIANCE_PATH = DATA_DIR / "compliance_accept.json"
COMPLIANCE_DOC_PATH = REPO_DIR / "docs" / "TERMO_RESPONSABILIDADE.md"


app = FastAPI(title="HelpSystem Portal API", version="1.0")
API_STARTED_AT = time.time()

_BINANCE_BASE = "https://api.binance.com"
_cache: dict[str, tuple[float, Any]] = {}
_auth_cache: dict[str, tuple[float, bool, Any | None]] = {}
_METRICS: dict[str, float] = {
    "api_requests_total": 0.0,
    "api_request_errors_total": 0.0,
    "api_request_duration_seconds_sum": 0.0,
    "api_request_duration_seconds_count": 0.0,
    "api_failures_total": 0.0,
}

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
_SUPPORT_TICKETS_PATH = DATA_DIR / "support_tickets.jsonl"

_SUPPORT_SECTORS: list[dict[str, str]] = [
    {"id": "acesso", "label": "Acesso e login"},
    {"id": "api_binance", "label": "API Binance"},
    {"id": "bot_operacao", "label": "Operação do bot"},
    {"id": "cobranca", "label": "Licença e cobrança"},
    {"id": "app_mobile", "label": "App mobile"},
    {"id": "portal_web", "label": "Painel web"},
    {"id": "infra_vps", "label": "Infraestrutura VPS"},
    {"id": "outros", "label": "Outros"},
]

_SUPPORT_PRIORITIES = {"baixa", "normal", "alta", "critica"}


def _default_error_message(status_code: int) -> str:
    messages = {
        400: "Requisição inválida. Revise os dados e tente novamente.",
        401: "Sessão inválida. Faça login novamente.",
        403: "Acesso negado para esta operação.",
        404: "Recurso não encontrado.",
        409: "Conflito de operação. Revise o estado atual e tente novamente.",
        422: "Dados inválidos. Revise os campos e tente novamente.",
        429: "Muitas tentativas em sequência. Aguarde alguns segundos.",
        500: "Erro interno do servidor. Tente novamente em instantes.",
        502: "Falha de comunicação com serviço externo. Tente novamente.",
        503: "Serviço temporariamente indisponível. Tente novamente.",
    }
    return messages.get(int(status_code), "Não foi possível concluir a operação agora. Tente novamente.")


def _detail_message(detail: Any, fallback: str) -> str:
    if isinstance(detail, str):
        txt = detail.strip()
        return txt or fallback
    if isinstance(detail, dict):
        for key in ("message", "error", "detail", "reason"):
            v = detail.get(key)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return fallback
    return fallback


def _request_id(request: Request | None) -> str | None:
    if request is None:
        return None
    state = getattr(request, "state", None)
    rid = getattr(state, "request_id", None)
    return str(rid) if rid else None


def _error_response(
    status_code: int,
    message: str,
    *,
    code: str | None = None,
    request: Request | None = None,
    meta: Any | None = None,
) -> JSONResponse:
    payload: dict[str, Any] = {
        "ok": False,
        "detail": message,
        "error": {
            "code": code or f"HTTP_{int(status_code)}",
            "message": message,
        },
    }
    rid = _request_id(request)
    if rid:
        payload["request_id"] = rid
    if meta is not None:
        payload["meta"] = meta
    return JSONResponse(status_code=int(status_code), content=payload)


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


def _auth_mode_from_flags(flags: dict[str, Any]) -> str:
    if not bool(flags.get("enable_auth", False)):
        return "none"
    base_url = str(flags.get("base_url", "") or "").strip()
    if bool(flags.get("enable_2fa", False)) and base_url:
        return "cloud"
    return "token"


def _cloud_base_url(flags: dict[str, Any]) -> str:
    return str(flags.get("base_url", "") or "").strip().rstrip("/")


def _portal_token_expected() -> str:
    return (os.getenv("HSP_PORTAL_TOKEN") or "local-dev").strip()


def _verify_cloud_token(base_url: str, token: str) -> tuple[bool, Any | None]:
    if not base_url or not token:
        return False, None
    now = time.time()
    cache_key = f"{base_url}|{token}"
    cached = _auth_cache.get(cache_key)
    if cached and cached[0] > now:
        return bool(cached[1]), cached[2]
    try:
        response = requests.get(
            f"{base_url}/api/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=6,
        )
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
    except Exception:
        _auth_cache[cache_key] = (now + 5, False, None)
        return False, None
    ok = response.status_code == 200 and bool(data.get("ok", False))
    user = data.get("user") if ok else None
    _auth_cache[cache_key] = (now + (20 if ok else 5), ok, user)
    return ok, user


def _cloud_billing_status(base_url: str, token: str) -> list[dict[str, Any]]:
    if not base_url or not token:
        return []
    cache_key = f"billing:{base_url}|{token}"
    cached = _cache_get(cache_key, ttl_s=10.0)
    if cached is not None and isinstance(cached, list):
        return cached
    try:
        response = requests.get(
            f"{base_url}/api/billing/status",
            headers={"Authorization": f"Bearer {token}"},
            timeout=8,
        )
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
        rows = data.get("rows") if isinstance(data, dict) else []
        if response.status_code >= 400 or not isinstance(rows, list):
            return []
        _cache_set(cache_key, rows)
        return rows
    except Exception:
        return []


def _cloud_features_for_token(flags: dict[str, Any], token: str) -> dict[str, Any]:
    base_url = _cloud_base_url(flags)
    rows = _cloud_billing_status(base_url, token)
    if not rows:
        return {}
    row = rows[0] if isinstance(rows[0], dict) else {}
    features = row.get("features") if isinstance(row.get("features"), dict) else {}
    can_live = bool(row.get("can_live", True))
    return {
        "features": features,
        "can_live": can_live,
        "live_block_reason": str(row.get("live_block_reason") or ""),
        "tenant_id": row.get("tenant_id"),
        "subscription_status": row.get("subscription_status"),
        "invoice_status": row.get("invoice_status"),
    }


def _telegram_alert_sync(message: str) -> None:
    try:
        env = load_env()
        if not env.telegram_api_key or not env.telegram_chat_id:
            return
        requests.post(
            f"https://api.telegram.org/bot{env.telegram_api_key}/sendMessage",
            data={"chat_id": env.telegram_chat_id, "text": f"⚠️ {message}"},
            timeout=6,
        )
    except Exception:
        return


@app.middleware("http")
async def local_first_guard(request: Request, call_next):  # type: ignore[no-untyped-def]
    started = time.time()

    def _finalize(resp: Any) -> Any:
        status_code = 200
        duration = 0.0
        try:
            duration = max(0.0, time.time() - started)
            _METRICS["api_requests_total"] = float(_METRICS.get("api_requests_total", 0.0) + 1.0)
            _METRICS["api_request_duration_seconds_sum"] = float(
                _METRICS.get("api_request_duration_seconds_sum", 0.0) + duration
            )
            _METRICS["api_request_duration_seconds_count"] = float(
                _METRICS.get("api_request_duration_seconds_count", 0.0) + 1.0
            )
            status_code = int(getattr(resp, "status_code", 200) or 200)
            if status_code >= 400:
                _METRICS["api_request_errors_total"] = float(_METRICS.get("api_request_errors_total", 0.0) + 1.0)
        except Exception:
            pass
        try:
            print(
                json.dumps(
                    {
                        "ts": datetime.now(timezone.utc).isoformat(),
                        "request_id": str(getattr(request.state, "request_id", "-")),
                        "method": request.method,
                        "path": str(request.url.path),
                        "status": status_code,
                        "duration_ms": round(duration * 1000.0, 2),
                        "tenant_id": str(getattr(request.state, "tenant_id", "") or ""),
                    },
                    ensure_ascii=False,
                )
            )
        except Exception:
            pass
        return resp

    raw_rid = (request.headers.get("x-request-id") or "").strip()
    request.state.request_id = raw_rid[:80] if raw_rid else uuid4().hex[:12]
    flags = get_runtime_flags()

    if bool(flags.get("local_only", True)):
        host = request.client.host if request.client else ""
        if host not in {"127.0.0.1", "::1"}:
            return _finalize(
                _error_response(
                    403,
                    "Acesso remoto desativado (Local-first).",
                    code="REMOTE_BLOCKED",
                    request=request,
                )
            )

    auth_mode = _auth_mode_from_flags(flags)
    if auth_mode != "none" and request.url.path.startswith("/api/"):
        public_paths = {
            "/api/health",
            "/api/metrics",
            "/api/ops/health",
        }
        if request.url.path in public_paths or request.url.path.startswith("/api/auth/"):
            response = await call_next(request)
            response.headers["X-Request-ID"] = str(request.state.request_id)
            return _finalize(response)
        token = _request_token(request)
        if auth_mode == "token":
            if token != _portal_token_expected():
                return _finalize(_error_response(403, "Token inválido.", code="INVALID_TOKEN", request=request))
        elif auth_mode == "cloud":
            ok, user = _verify_cloud_token(_cloud_base_url(flags), token or "")
            if not ok:
                return _finalize(
                    _error_response(401, "Sessão inválida. Faça login novamente.", code="INVALID_SESSION", request=request)
                )
            try:
                if isinstance(user, dict):
                    request.state.user_email = str(user.get("email") or "").strip().lower()
                    request.state.user_id = str(user.get("id") or "").strip()
                links = user.get("links") if isinstance(user, dict) else []
                if isinstance(links, list) and links:
                    first = links[0]
                    if isinstance(first, dict):
                        request.state.tenant_id = str(first.get("tenant_id") or "")
            except Exception:
                pass

    response = await call_next(request)
    response.headers["X-Request-ID"] = str(request.state.request_id)
    return _finalize(response)

@app.exception_handler(HTTPException)
async def _http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    status_code = int(exc.status_code)
    fallback = _default_error_message(status_code)
    message = _detail_message(exc.detail, fallback)
    meta = exc.detail if isinstance(exc.detail, (dict, list)) else None
    return _error_response(status_code, message, request=request, meta=meta)


@app.exception_handler(RequestValidationError)
async def _validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return _error_response(
        422,
        "Dados inválidos. Revise os campos e tente novamente.",
        code="VALIDATION_ERROR",
        request=request,
        meta={"errors": exc.errors()},
    )


@app.exception_handler(Exception)
async def _unexpected_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    rid = _request_id(request) or "-"
    print(f"[portal_api][{rid}] erro inesperado: {exc}", file=sys.stderr)
    return _error_response(
        500,
        _default_error_message(500),
        code="INTERNAL_ERROR",
        request=request,
    )


@app.get("/api/auth/config")
def api_auth_config() -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    return {
        "ok": True,
        "mode": mode,
        "requires_2fa": mode == "cloud",
        "cloud_base_url": _cloud_base_url(flags) if mode == "cloud" else "",
        "help": "Use o mesmo usuário do painel administrativo (Cloud) quando o modo for cloud.",
    }


@app.post("/api/auth/login")
def api_auth_login(payload: dict[str, Any]) -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    if mode == "none":
        return {"ok": True, "mode": mode, "token": ""}
    if mode == "token":
        token = str(payload.get("token", "")).strip()
        if token != _portal_token_expected():
            raise HTTPException(status_code=403, detail="Token inválido.")
        return {"ok": True, "mode": mode, "token": token}

    base_url = _cloud_base_url(flags)
    if not base_url:
        raise HTTPException(status_code=500, detail="Cloud API não configurada para login.")
    body = {
        "email": str(payload.get("email", "")).strip(),
        "password": str(payload.get("password", "")),
        "totp": str(payload.get("totp", "")).strip(),
    }
    if not body["email"] or not body["password"] or not body["totp"]:
        raise HTTPException(status_code=400, detail="Informe e-mail, senha e código 2FA.")
    try:
        response = requests.post(f"{base_url}/api/login", json=body, timeout=8)
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao conectar no painel administrativo.") from None
    if response.status_code >= 400 or not bool(data.get("ok", False)):
        detail = data.get("detail") or data.get("error") or "Login inválido no painel administrativo."
        raise HTTPException(status_code=401 if response.status_code in (401, 403, 428) else 400, detail=detail)
    token = str(data.get("token", "")).strip()
    if not token:
        raise HTTPException(status_code=500, detail="Resposta de login sem token.")
    _auth_cache[f"{base_url}|{token}"] = (time.time() + 20, True, None)
    return {"ok": True, "mode": mode, "token": token, "role": data.get("role"), "tenantIds": data.get("tenantIds", [])}


@app.get("/api/auth/plans")
def api_auth_plans() -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    if mode != "cloud":
        return {"ok": True, "mode": mode, "plans": []}
    base_url = _cloud_base_url(flags)
    try:
        response = requests.get(f"{base_url}/api/public/plans", timeout=8)
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao carregar catálogo de planos.") from None
    if response.status_code >= 400 or not bool(data.get("ok", False)):
        raise HTTPException(status_code=400, detail="Não foi possível carregar os planos agora.")
    return data


@app.post("/api/auth/register-request")
def api_auth_register_request(payload: dict[str, Any]) -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    if mode != "cloud":
        raise HTTPException(status_code=400, detail="Cadastro público disponível apenas no modo cloud.")
    base_url = _cloud_base_url(flags)
    body = {
        "fullName": str(payload.get("fullName", "")).strip(),
        "email": str(payload.get("email", "")).strip(),
        "password": str(payload.get("password", "")),
        "plan": str(payload.get("plan", "")).strip(),
        "billingCycle": str(payload.get("billingCycle", "")).strip(),
        "objective": str(payload.get("objective", "")).strip(),
    }
    try:
        response = requests.post(f"{base_url}/api/public/register-request", json=body, timeout=8)
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao enviar cadastro para aprovação.") from None
    if response.status_code >= 400 or not bool(data.get("ok", False)):
        detail = data.get("detail") or data.get("error") or "Não foi possível registrar sua solicitação."
        raise HTTPException(status_code=int(response.status_code or 400), detail=detail)
    return data


@app.post("/api/auth/totp/setup-start")
def api_auth_totp_setup_start(payload: dict[str, Any]) -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    if mode != "cloud":
        raise HTTPException(status_code=400, detail="2FA disponível apenas no modo cloud.")
    base_url = _cloud_base_url(flags)
    body = {
        "email": str(payload.get("email", "")).strip(),
        "password": str(payload.get("password", "")),
    }
    try:
        response = requests.post(f"{base_url}/api/totp/setup-start", json=body, timeout=8)
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao iniciar configuração de 2FA.") from None
    if response.status_code >= 400 or not bool(data.get("ok", False)):
        detail = data.get("detail") or data.get("error") or "Não foi possível gerar QR do 2FA."
        raise HTTPException(status_code=int(response.status_code or 400), detail=detail)
    return data


@app.post("/api/auth/totp/enable")
def api_auth_totp_enable(payload: dict[str, Any]) -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    if mode != "cloud":
        raise HTTPException(status_code=400, detail="2FA disponível apenas no modo cloud.")
    base_url = _cloud_base_url(flags)
    body = {
        "email": str(payload.get("email", "")).strip(),
        "password": str(payload.get("password", "")),
        "code": str(payload.get("code", "")).strip(),
    }
    try:
        response = requests.post(f"{base_url}/api/totp/enable", json=body, timeout=8)
        data = response.json() if "application/json" in str(response.headers.get("content-type", "")).lower() else {}
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao ativar 2FA.") from None
    if response.status_code >= 400 or not bool(data.get("ok", False)):
        detail = data.get("detail") or data.get("error") or "Não foi possível ativar 2FA."
        raise HTTPException(status_code=int(response.status_code or 400), detail=detail)
    return data


@app.get("/api/auth/verify")
def api_auth_verify(request: Request) -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    if mode == "none":
        return {"ok": True, "mode": mode, "authenticated": True}
    token = _request_token(request) or ""
    if mode == "token":
        authenticated = token == _portal_token_expected()
        return {"ok": authenticated, "mode": mode, "authenticated": authenticated}
    ok, user = _verify_cloud_token(_cloud_base_url(flags), token)
    return {"ok": ok, "mode": mode, "authenticated": ok, "user": user if ok else None}


@app.get("/api/auth/feature-flags")
def api_auth_feature_flags(request: Request) -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    token = _request_token(request) or ""
    if mode != "cloud":
        return {"ok": True, "mode": mode, "features": {}}
    cloud_info = _cloud_features_for_token(flags, token)
    return {
        "ok": True,
        "mode": mode,
        "tenant_id": cloud_info.get("tenant_id"),
        "features": cloud_info.get("features") if isinstance(cloud_info.get("features"), dict) else {},
        "can_live": bool(cloud_info.get("can_live", True)),
        "live_block_reason": str(cloud_info.get("live_block_reason") or ""),
        "subscription_status": cloud_info.get("subscription_status"),
        "invoice_status": cloud_info.get("invoice_status"),
    }


@app.post("/api/auth/logout")
def api_auth_logout(request: Request) -> dict[str, Any]:
    flags = get_runtime_flags()
    token = _request_token(request)
    if token:
        _auth_cache.pop(f"{_cloud_base_url(flags)}|{token}", None)
    return {"ok": True}


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
    _ensure("risk_max_orders_per_day", (int, float))
    _ensure("risk_max_exposure_quote_usdt_per_symbol", (int, float))
    _ensure("risk_max_drawdown_usdt", (int, float))
    _ensure("regime_volatility_target_1h", (int, float))
    _ensure("position_size_min_multiplier", (int, float))
    _ensure("position_size_max_multiplier", (int, float))
    _ensure("event_news_max_items", (int, float))
    _ensure("event_news_weight", (int, float))
    _ensure("event_market_weight", (int, float))
    _ensure("event_sentiment_weight", (int, float))
    _ensure("event_bus_history_limit", (int, float))
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
            _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)
            return None
        data = r.json()
        price = float(data.get("price", 0) or 0)
        if price <= 0:
            return None
        _cache_set(cache_key, price)
        return price
    except Exception:
        _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)
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


def _support_sector_ids() -> set[str]:
    return {str(item.get("id")) for item in _SUPPORT_SECTORS if str(item.get("id", "")).strip()}


def _normalize_support_text(value: Any, *, max_len: int) -> str:
    text = str(value or "").strip()
    return text[:max_len]


def _read_support_tickets(limit: int = 200, reporter: str | None = None) -> list[dict[str, Any]]:
    if not _SUPPORT_TICKETS_PATH.exists():
        return []
    rows: list[dict[str, Any]] = []
    for line in _SUPPORT_TICKETS_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except Exception:
            continue
        if not isinstance(item, dict):
            continue
        if reporter and str(item.get("reporter_email") or "").strip().lower() != reporter.strip().lower():
            continue
        rows.append(item)
    rows.sort(key=lambda x: str(x.get("created_at") or ""), reverse=True)
    return rows[: int(max(1, min(limit, 5000)))]


def _append_support_ticket(item: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with _SUPPORT_TICKETS_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


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


def _require_token(request: Request | None, token: str | None = None) -> None:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    tok = token or (_request_token(request) if request is not None else None)
    if mode == "cloud":
        ok, _ = _verify_cloud_token(_cloud_base_url(flags), tok or "")
        if not ok:
            raise HTTPException(status_code=401, detail="Sessão inválida. Faça login novamente.")
        return

    expected = os.getenv("HSP_PORTAL_TOKEN")
    if not expected:
        raise HTTPException(
            status_code=403,
            detail="Escrita de configuração desativada. Defina HSP_PORTAL_TOKEN e reinicie o servidor.",
        )
    if tok != expected:
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


def _bot_start(*, dry_run: bool, once: bool, feature_flags: dict[str, Any] | None = None) -> dict[str, Any]:
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
        env={
            **os.environ,
            "HSP_PLAN_MAX_SYMBOLS": str(int((feature_flags or {}).get("max_symbols", 0) or 0)),
            "HSP_PLAN_MAX_ORDERS_PER_DAY": str(int((feature_flags or {}).get("max_orders_per_day", 0) or 0)),
            "HSP_PLAN_RISK_ADVANCED": "1" if bool((feature_flags or {}).get("risk_advanced", False)) else "0",
            "HSP_PLAN_TELEGRAM_ALERTS": "1" if bool((feature_flags or {}).get("telegram_alerts", False)) else "0",
            "HSP_PLAN_DECISION_V2": "1" if bool((feature_flags or {}).get("decision_engine_v2", True)) else "0",
        },
        creationflags=creationflags,
    )
    _write_pid(int(p.pid))
    state = {
        "started_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "args": args[1:],
        "dry_run": dry_run,
        "once": once,
        "plan_features": feature_flags or {},
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
    return {"ok": True, "started_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(API_STARTED_AT))} 
 
 
def _is_private_ipv4(ip: str) -> bool:
    ip = (ip or "").strip()
    if not ip or ":" in ip:
        return False
    if ip.startswith("10."):
        return True
    if ip.startswith("192.168."):
        return True
    if ip.startswith("172."):
        try:
            b = int(ip.split(".")[1])
            return 16 <= b <= 31
        except Exception:
            return False
    return False


def _detect_lan_ipv4_candidates() -> list[str]:
    out: list[str] = []

    # Melhor tentativa: IP usado na rota padrão (não depende de DNS).
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            if ip and ip not in out:
                out.append(ip)
        finally:
            try:
                s.close()
            except Exception:
                pass
    except Exception:
        pass

    # Fallback: hostname -> lista de IPs
    try:
        _, _, addrs = socket.gethostbyname_ex(socket.gethostname())
        for ip in addrs:
            if ip and ip not in out:
                out.append(ip)
    except Exception:
        pass

    # Remove loopback e vazio
    out = [ip for ip in out if ip and not ip.startswith("127.")]

    # Ordena: preferir 192.168.* > 10.* > 172.16-31.*
    def _score(ip: str) -> int:
        if ip.startswith("192.168."):
            return 0
        if ip.startswith("10."):
            return 1
        if ip.startswith("172."):
            return 2
        return 3

    out.sort(key=_score)
    return out


@app.get("/api/net/lan_ip")
def net_lan_ip() -> dict[str, Any]:
    """
    Retorna um IPv4 provável para acesso na LAN.
    Útil para gerar QR no portal quando o usuário abriu o painel via localhost,
    mas quer conectar o app no celular.
    """
    candidates = _detect_lan_ipv4_candidates()
    lan_ip = ""
    for ip in candidates:
        if _is_private_ipv4(ip):
            lan_ip = ip
            break
    if not lan_ip and candidates:
        lan_ip = candidates[0]
    return {"ok": True, "lan_ip": lan_ip, "candidates": candidates}


@app.get("/api/version") 
def version() -> dict[str, Any]: 
    """
    Retorna informaÃ§Ãµes de versÃ£o para confirmar que o cliente estÃ¡ rodando a build correta.
    Em local-dev, tenta ler o hash do git (se disponÃ­vel).
    """
    git = None
    try:
        git = (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=str(REPO_DIR), stderr=subprocess.DEVNULL)
            .decode("utf-8", errors="replace")
            .strip()
        )
    except Exception:
        git = None

    return {
        "ok": True,
        "app": "HelpSystem • Binance Bot",
        "api_version": "1.0",
        "git": git,
        "python": sys.version.split(" ")[0],
        "started_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(API_STARTED_AT)),
        "paths": {"repo": str(REPO_DIR), "data": str(DATA_DIR), "portal": str(PORTAL_DIR)},
    }


@app.on_event("startup")
def _autostart_bot() -> None:
    """
    Autostart opcional (para VPS 24/7).
    Segurança:
    - Por padrão, autostart roda em dry-run.
    - Não inicia LIVE automaticamente.
    """
    try:
        if not (env_flag("HSP_AUTOSTART_BOT", False) or env_flag("AUTOSTART_BOT", False)):
            return
        if bool(read_kill_switch().get("enabled", False)):
            return

        settings = load_settings()
        dry_run = env_flag("HSP_AUTOSTART_DRY_RUN", True)
        once = env_flag("HSP_AUTOSTART_ONCE", False)

        # Nunca autostarta LIVE.
        if not bool(settings.get("testnet", True)) and not bool(dry_run):
            return

        _bot_start(dry_run=bool(dry_run), once=bool(once))
    except Exception:
        return


def _port_listening(host: str, port: int, timeout_s: float = 0.2) -> bool:
    try:
        with socket.create_connection((host, int(port)), timeout=timeout_s):
            return True
    except Exception:
        return False


def _event_totals() -> dict[str, float]:
    totals = {
        "orders": 0.0,
        "risk_blocks": 0.0,
        "errors": 0.0,
        "cycle_duration_sum": 0.0,
        "cycle_duration_count": 0.0,
    }
    p = events_path()
    if not p.exists():
        return totals
    try:
        with p.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = (line or "").strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                event_type = str(obj.get("event_type") or "")
                severity = str(obj.get("severity") or "").lower()
                if event_type == "order.placed":
                    totals["orders"] += 1.0
                if event_type in {"risk.block", "cycle.blocked"}:
                    totals["risk_blocks"] += 1.0
                if severity == "critical" or event_type.endswith(".error"):
                    totals["errors"] += 1.0
                if event_type == "cycle.finished":
                    payload = obj.get("payload") if isinstance(obj.get("payload"), dict) else {}
                    duration = float(payload.get("duration_s") or 0.0)
                    if duration >= 0:
                        totals["cycle_duration_sum"] += duration
                        totals["cycle_duration_count"] += 1.0
    except Exception:
        return totals
    return totals


def _subscription_status_for_ops() -> dict[str, Any]:
    flags = get_runtime_flags()
    mode = _auth_mode_from_flags(flags)
    base_url = _cloud_base_url(flags)
    if mode != "cloud" or not base_url:
        return {"mode": mode, "status": "not_applicable", "can_live": True}
    service_token = str(os.getenv("HSP_SERVICE_TOKEN") or "").strip()
    if not service_token:
        return {
            "mode": mode,
            "status": "unknown",
            "can_live": False,
            "reason": "HSP_SERVICE_TOKEN não configurado para verificar assinatura no health.",
        }
    rows = _cloud_billing_status(base_url, service_token)
    if not rows:
        return {"mode": mode, "status": "unknown", "can_live": False, "reason": "Sem retorno do Cloud para cobrança."}
    row = rows[0] if isinstance(rows[0], dict) else {}
    return {
        "mode": mode,
        "tenant_id": row.get("tenant_id"),
        "subscription_status": row.get("subscription_status"),
        "invoice_status": row.get("invoice_status"),
        "can_live": bool(row.get("can_live", True)),
        "reason": str(row.get("live_block_reason") or ""),
    }


@app.get("/api/license/status")
def license_status() -> dict[str, Any]:
    return get_license_status()


@app.post("/api/license/save")
def license_save(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(request, token)
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Payload inválido.")
    p = save_license_obj(payload)
    append_audit_event(
        event="license.save",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"path": str(p)},
    )
    return {"ok": True, "path": str(p), "status": get_license_status()}


def _read_compliance_accept() -> dict[str, Any] | None:
    try:
        if not COMPLIANCE_PATH.exists():
            return None
        obj = json.loads(COMPLIANCE_PATH.read_text(encoding="utf-8", errors="replace"))
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _write_compliance_accept(obj: dict[str, Any]) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    COMPLIANCE_PATH.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


@app.get("/api/compliance/term")
def compliance_term() -> dict[str, Any]:
    try:
        if COMPLIANCE_DOC_PATH.exists():
            return {"ok": True, "version": "1.0", "path": str(COMPLIANCE_DOC_PATH), "text": COMPLIANCE_DOC_PATH.read_text(encoding="utf-8", errors="replace")}
    except Exception:
        pass
    return {"ok": True, "version": "1.0", "path": None, "text": "Termo indisponível. Consulte docs/TERMO_RESPONSABILIDADE.md"}


@app.get("/api/compliance/status")
def compliance_status() -> dict[str, Any]:
    obj = _read_compliance_accept()
    return {
        "accepted": bool(obj),
        "path": str(COMPLIANCE_PATH),
        "record": obj,
    }


@app.post("/api/compliance/accept")
def compliance_accept(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(request, token)
    version = str(payload.get("version") or "1.0").strip() or "1.0"
    rec = {
        "accepted_at_utc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "version": version,
        "client_host": (request.client.host if request.client else None),
    }
    _write_compliance_accept(rec)
    append_audit_event(
        event="compliance.accept",
        token=token,
        client_host=(request.client.host if request.client else None),
        detail={"version": version},
    )
    return {"ok": True, "accepted": True, "path": str(COMPLIANCE_PATH), "record": rec}


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

    intelligence: dict[str, Any] | None = None
    if not dec.empty:
        try:
            details_raw = dec.iloc[0]["details_json"]
            details_obj = json.loads(details_raw) if isinstance(details_raw, str) else (details_raw or {})
            if isinstance(details_obj, dict):
                sig = details_obj.get("signals") if isinstance(details_obj.get("signals"), dict) else {}
                regime = sig.get("regime") if isinstance(sig.get("regime"), dict) else {}
                intelligence = {
                    "decision_engine": sig.get("decision_engine") or "legacy",
                    "regime": regime.get("name"),
                    "regime_risk": regime.get("risk_level"),
                    "technical_score": sig.get("technical_score"),
                    "event_score": sig.get("event_score"),
                    "liquidity_score": sig.get("liquidity_score"),
                    "position_size_multiplier": sig.get("position_size_multiplier"),
                }
        except Exception:
            intelligence = None

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
        "intelligence": intelligence,
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


@app.get("/api/decisions/explain/latest")
def decisions_explain_latest(symbol: str | None = None) -> dict[str, Any]:
    storage = Storage()
    df = storage.decisions_df(limit=300)
    if df.empty:
        return {"ok": True, "found": False, "message": "Sem decisões registradas ainda."}

    selected = None
    normalized_symbol = str(symbol or "").strip().upper()
    for _, row in df.iterrows():
        row_symbol = str(row.get("symbol") or "").upper()
        if normalized_symbol and row_symbol != normalized_symbol:
            continue
        selected = row
        break

    if selected is None:
        return {
            "ok": True,
            "found": False,
            "message": f"Nenhuma decisão encontrada para {normalized_symbol}.",
        }

    details_raw = selected.get("details_json")
    details: dict[str, Any] = {}
    if isinstance(details_raw, str):
        try:
            details = json.loads(details_raw)
        except Exception:
            details = {}
    elif isinstance(details_raw, dict):
        details = details_raw

    signals = details.get("signals") if isinstance(details.get("signals"), dict) else {}
    event_context = signals.get("event_context") if isinstance(signals.get("event_context"), dict) else {}
    breakdown = {
        "weights": signals.get("weights") if isinstance(signals.get("weights"), dict) else {},
        "technical_score": float(signals.get("technical_score") or 0.0),
        "sentiment_score": float(signals.get("sentiment_score") or 0.0),
        "event_score": float(signals.get("event_score") or 0.0),
        "regime_score": float(signals.get("regime_score") or 0.0),
        "liquidity_score": float(signals.get("liquidity_score") or 0.0),
        "confidence": float(selected.get("confidence") or 0.0),
        "position_size_multiplier": float(signals.get("position_size_multiplier") or 1.0),
    }

    return {
        "ok": True,
        "found": True,
        "decision": {
            "ts_utc": selected.get("ts_utc"),
            "symbol": selected.get("symbol"),
            "action": selected.get("action"),
            "score": float(selected.get("score") or 0.0),
            "confidence": float(selected.get("confidence") or 0.0),
        },
        "breakdown": breakdown,
        "regime": signals.get("regime") if isinstance(signals.get("regime"), dict) else {},
        "event_context": event_context,
        "explain": details.get("explain") if isinstance(details.get("explain"), list) else [],
    }


@app.get("/api/logs")
def logs(lines: int = Query(300, ge=10, le=5000)) -> dict[str, Any]:
    log_path = logs_dir() / "trading_bot.log"
    if not log_path.exists():
        return {"path": str(log_path), "lines": []}
    content = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    return {"path": str(log_path), "lines": content[-int(lines) :]}


@app.get("/api/support/sectors")
def support_sectors() -> dict[str, Any]:
    return {"rows": _SUPPORT_SECTORS, "priorities": sorted(_SUPPORT_PRIORITIES)}


@app.get("/api/support/tickets")
def support_tickets(
    request: Request,
    token: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    mine: bool = Query(True),
) -> dict[str, Any]:
    _require_token(request, token)
    reporter = None
    flags = get_runtime_flags()
    if _auth_mode_from_flags(flags) == "cloud" and mine:
        reporter = str(getattr(request.state, "user_email", "") or "").strip().lower() or None
    rows = _read_support_tickets(limit=limit, reporter=reporter)
    return {"rows": rows, "count": len(rows), "mine": bool(reporter)}


@app.post("/api/support/tickets")
def support_ticket_create(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(request, token)

    sector = _normalize_support_text(payload.get("sector"), max_len=40).lower()
    if not sector:
        raise HTTPException(status_code=422, detail="Selecione o setor do atendimento.")
    if sector not in _support_sector_ids():
        raise HTTPException(status_code=422, detail="Setor inválido. Selecione uma opção da lista.")

    subject = _normalize_support_text(payload.get("subject"), max_len=140)
    if len(subject) < 5:
        raise HTTPException(status_code=422, detail="Informe um assunto com pelo menos 5 caracteres.")

    message = _normalize_support_text(payload.get("message"), max_len=6000)
    if len(message) < 10:
        raise HTTPException(status_code=422, detail="Descreva o problema com pelo menos 10 caracteres.")

    priority = _normalize_support_text(payload.get("priority") or "normal", max_len=20).lower()
    if priority not in _SUPPORT_PRIORITIES:
        priority = "normal"

    reporter_email = (
        _normalize_support_text(getattr(request.state, "user_email", ""), max_len=180).lower()
        or _normalize_support_text(payload.get("email"), max_len=180).lower()
    )
    reporter_name = _normalize_support_text(payload.get("name"), max_len=120)
    channel = _normalize_support_text(payload.get("channel") or "web", max_len=30).lower()
    platform_name = _normalize_support_text(payload.get("platform") or "portal", max_len=40).lower()
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}

    ticket_id = f"SUP-{datetime.now(timezone.utc).strftime('%Y%m%d')}-{uuid4().hex[:8].upper()}"
    now_iso = datetime.now(timezone.utc).isoformat()
    item = {
        "id": ticket_id,
        "created_at": now_iso,
        "updated_at": now_iso,
        "status": "aberto",
        "sector": sector,
        "priority": priority,
        "subject": subject,
        "message": message,
        "reporter_email": reporter_email,
        "reporter_name": reporter_name,
        "channel": channel,
        "platform": platform_name,
        "tenant_id": str(getattr(request.state, "tenant_id", "") or ""),
        "request_id": str(getattr(request.state, "request_id", "") or ""),
        "context": context,
    }
    _append_support_ticket(item)
    append_audit_event(
        event="support.ticket_opened",
        details={"id": ticket_id, "sector": sector, "priority": priority, "platform": platform_name, "channel": channel},
    )
    _telegram_alert_sync(f"[SUPORTE] {ticket_id} • {sector} • {priority} • {subject}")
    return {
        "ok": True,
        "message": "Chamado aberto com sucesso. Nossa equipe vai analisar e responder em breve.",
        "ticket": item,
    }


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
    _require_token(request, token)
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
    flags = get_runtime_flags()
    auth_mode = _auth_mode_from_flags(flags)
    request_token = token or _request_token(request) or ""
    cloud_guard: dict[str, Any] = {}
    features: dict[str, Any] = {}
    if auth_mode == "cloud":
        cloud_guard = _cloud_features_for_token(flags, request_token)
        features = cloud_guard.get("features") if isinstance(cloud_guard.get("features"), dict) else {}
        if isinstance(features, dict) and features:
            max_symbols = int(features.get("max_symbols", 0) or 0)
            configured_symbols = [s for s in (settings.get("moedas_monitoradas") or []) if str(s).strip()]
            if max_symbols > 0 and len(configured_symbols) > max_symbols:
                raise HTTPException(
                    status_code=403,
                    detail=f"Seu plano permite no máximo {max_symbols} moedas monitoradas. Ajuste em Configurações.",
                )
            max_orders_plan = int(features.get("max_orders_per_day", 0) or 0)
            configured_orders = int(settings.get("risk_max_orders_per_day", 0) or 0)
            if max_orders_plan > 0 and configured_orders > max_orders_plan:
                raise HTTPException(
                    status_code=403,
                    detail=(
                        f"Seu plano permite até {max_orders_plan} ordens/dia. "
                        "Reduza risk_max_orders_per_day para iniciar."
                    ),
                )
            if not bool(features.get("risk_advanced", False)):
                drawdown_limit = float(settings.get("risk_max_drawdown_usdt", 0.0) or 0.0)
                if drawdown_limit > 0:
                    raise HTTPException(
                        status_code=403,
                        detail="Seu plano atual não inclui controles avançados de drawdown.",
                    )
            if not bool(features.get("cloud_execution", False)) and not bool(dry_run):
                raise HTTPException(
                    status_code=403,
                    detail="Seu plano não libera execução em LIVE. Use dry-run/testnet ou faça upgrade.",
                )

    if not bool(settings.get("testnet", True)):
        if not (env_flag("HSP_LIVE_TRADING", False) or env_flag("LIVE_MODE", False) or env_flag("HSP_LIVE_MODE", False)):
            raise HTTPException(
                status_code=400,
                detail="Segurança: settings.yml está com testnet=false, mas HSP_LIVE_TRADING não está habilitado. "
                "Para operar em conta real, defina HSP_LIVE_TRADING=1 e reinicie.",
            )
        if auth_mode == "cloud" and not bool(cloud_guard.get("can_live", True)):
            _telegram_alert_sync(
                "LIVE bloqueado por assinatura/cobrança. Regularize no painel administrativo antes de operar."
            )
            raise HTTPException(
                status_code=403,
                detail="LIVE bloqueado por assinatura/cobrança: " + str(cloud_guard.get("live_block_reason") or "regularize no painel administrativo."),
            )
        # Licença: bloqueia LIVE se inválida/expirada (dry-run/testnet não exigem).
        if not bool(dry_run):
            comp = _read_compliance_accept()
            if not comp:
                raise HTTPException(
                    status_code=428,
                    detail="Antes do LIVE, aceite o Termo de Responsabilidade no painel (Saúde → Licença/Termo).",
                )
            lic = get_license_status()
            if not bool(lic.get("valid", False)):
                raise HTTPException(
                    status_code=403,
                    detail="Licença inválida para LIVE: "
                    + str(lic.get("reason") or "verifique a licença")
                    + " (veja Configurações → Licença).",
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
        detail={
            "dry_run": bool(dry_run),
            "once": bool(once),
            "testnet": bool(settings.get("testnet", True)),
            "tenant_id": cloud_guard.get("tenant_id"),
            "plan_features": features,
        },
    )
    return _bot_start(dry_run=bool(dry_run), once=bool(once), feature_flags=features)


@app.post("/api/bot/stop")
def bot_stop(request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(request, token)
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
    _require_token(request, token)
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
            "fees_usdt": stats.fees_usdt,
            "orders_count": stats.orders_count,
            "executions_count": stats.executions_count,
            "drawdown_usdt_est": stats.drawdown_usdt_est,
        },
        "limits": decision.limits,
        "ok_to_buy": decision.ok_to_buy,
        "reason": decision.reason,
    }


@app.get("/api/pnl/realized")
def pnl_realized(
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(200000, ge=100, le=500000),
) -> dict[str, Any]:
    """
    PnL realizado (FIFO) com fees quando disponíveis (fills/commission).
    Breakdown por símbolo e por trade/order.
    """
    storage = Storage()
    now = datetime.now(timezone.utc)
    start = (now - timedelta(days=int(days))).replace(microsecond=0)
    trades = load_trades(storage, start_utc=start.isoformat(), end_utc=None, limit=int(limit))
    executions = []
    for t in trades:
        executions.extend(expand_executions(t))
    out = compute_realized_fifo(executions, price_fetch_usdt=_public_price)
    out["range"] = {"days": int(days), "start_utc": start.isoformat(), "end_utc": now.isoformat(), "limit": int(limit)}
    return out


@app.get("/api/events/recent")
def events_recent(limit: int = Query(100, ge=1, le=1000), event_type: str | None = None) -> dict[str, Any]:
    bus = get_event_bus()
    return {
        "rows": bus.recent(limit=int(limit), event_type=event_type),
        "path": str(events_path()),
    }


@app.get("/api/events/stats")
def events_stats() -> dict[str, Any]:
    bus = get_event_bus()
    return bus.stats()


@app.get("/api/export/audit.csv")
def export_audit_csv(request: Request, token: str | None = None) -> StreamingResponse:
    _require_token(request, token)
    p = Path(audit_path())
    if not p.exists():
        raise HTTPException(status_code=404, detail="audit.jsonl não encontrado.")

    def gen():  # type: ignore[no-untyped-def]
        header = ["ts_utc", "event", "client_host", "token_fp", "detail_json"]
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(header)
        yield out.getvalue()

        with p.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                line = (line or "").strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                row = [
                    obj.get("ts_utc"),
                    obj.get("event"),
                    obj.get("client_host"),
                    obj.get("token_fp"),
                    json.dumps(obj.get("detail") or {}, ensure_ascii=False),
                ]
                out = io.StringIO()
                w = csv.writer(out)
                w.writerow(row)
                yield out.getvalue()

    return StreamingResponse(
        gen(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="audit.csv"'},
    )


@app.get("/api/export/trades.csv")
def export_trades_csv(request: Request, token: str | None = None, limit: int = Query(200000, ge=100, le=500000)) -> StreamingResponse:
    _require_token(request, token)
    storage = Storage()

    def gen():  # type: ignore[no-untyped-def]
        header = ["id", "ts_utc", "symbol", "side", "qty", "price", "quote_qty", "status", "order_id"]
        out = io.StringIO()
        w = csv.writer(out)
        w.writerow(header)
        yield out.getvalue()

        q = "SELECT id, ts_utc, symbol, side, qty, price, quote_qty, status, order_id FROM trades ORDER BY id ASC LIMIT ?"
        with storage._connect() as con:  # noqa: SLF001
            rows = con.execute(q, (int(limit),)).fetchall()
        for r in rows:
            out = io.StringIO()
            w = csv.writer(out)
            w.writerow(list(r))
            yield out.getvalue()

    return StreamingResponse(
        gen(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="trades.csv"'},
    )


@app.get("/api/metrics")
def metrics() -> StreamingResponse:
    storage = Storage()
    event_totals = _event_totals()
    request_count = float(_METRICS.get("api_request_duration_seconds_count", 0.0) or 0.0)
    request_sum = float(_METRICS.get("api_request_duration_seconds_sum", 0.0) or 0.0)
    avg_cycle = (
        float(event_totals.get("cycle_duration_sum", 0.0)) / float(event_totals.get("cycle_duration_count", 1.0))
        if float(event_totals.get("cycle_duration_count", 0.0)) > 0
        else 0.0
    )
    with storage._connect() as con:  # noqa: SLF001
        trades_total = int(con.execute("SELECT COUNT(*) FROM trades").fetchone()[0])
    lines = [
        "# HELP bot_orders_total Total de ordens registradas (trades).",
        "# TYPE bot_orders_total counter",
        f"bot_orders_total {trades_total}",
        "# HELP bot_risk_blocks_total Total de bloqueios por risco.",
        "# TYPE bot_risk_blocks_total counter",
        f"bot_risk_blocks_total {int(event_totals.get('risk_blocks', 0.0))}",
        "# HELP bot_errors_total Total de erros críticos observados.",
        "# TYPE bot_errors_total counter",
        f"bot_errors_total {int(event_totals.get('errors', 0.0))}",
        "# HELP bot_cycle_duration_seconds Duração média dos ciclos concluídos.",
        "# TYPE bot_cycle_duration_seconds gauge",
        f"bot_cycle_duration_seconds {avg_cycle:.6f}",
        "# HELP api_request_duration_seconds Soma da latência das requisições HTTP.",
        "# TYPE api_request_duration_seconds summary",
        f"api_request_duration_seconds_sum {request_sum:.6f}",
        f"api_request_duration_seconds_count {int(request_count)}",
        "# HELP api_failures_total Falhas de integração com APIs externas.",
        "# TYPE api_failures_total counter",
        f"api_failures_total {int(_METRICS.get('api_failures_total', 0.0))}",
    ]
    return StreamingResponse(
        iter(["\n".join(lines) + "\n"]),
        media_type="text/plain; version=0.0.4; charset=utf-8",
    )


@app.get("/api/ops/health")
def ops_health() -> dict[str, Any]:
    """
    Saúde operacional (Local-first):
    - uptime do servidor
    - status do bot/pid
    - último ciclo/erro (bot_runtime.json)
    - portas (8501/8502) listening
    - risco diário + licença
    """
    storage = Storage()
    runtime_path = DATA_DIR / "bot_runtime.json"
    runtime = {}
    try:
        if runtime_path.exists():
            runtime = json.loads(runtime_path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        runtime = {}

    db_ok = True
    try:
        with storage._connect() as con:  # noqa: SLF001
            con.execute("SELECT 1").fetchone()
    except Exception:
        db_ok = False

    exchange_ok = True
    exchange_message = "ok"
    try:
        r = requests.get(f"{_BINANCE_BASE}/api/v3/ping", timeout=5)
        if int(r.status_code) >= 400:
            exchange_ok = False
            exchange_message = f"status {r.status_code}"
    except Exception as exc:
        exchange_ok = False
        exchange_message = str(exc)
        _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)

    risk = compute_daily_risk_stats(storage)
    bus = get_event_bus()
    flags = get_runtime_flags()
    bot_info = {**_bot_status(), "kill_switch": read_kill_switch()}
    return {
        "api": {
            "started_at_utc": datetime.fromtimestamp(API_STARTED_AT, tz=timezone.utc).isoformat().replace("+00:00", "Z"),
            "uptime_s": round(time.time() - API_STARTED_AT, 3),
            "python": sys.version.split(" ")[0],
        },
        "db": {
            "ok": db_ok,
            "path": str(storage.db_path),
        },
        "exchange": {
            "ok": exchange_ok,
            "message": exchange_message,
        },
        "worker": {
            "running": bool(bot_info.get("running", False)),
            "pid": bot_info.get("pid"),
        },
        "subscription": _subscription_status_for_ops(),
        "ports": {
            "8501_panel_listening": _port_listening("127.0.0.1", 8501),
            "8502_api_listening": _port_listening("127.0.0.1", 8502),
        },
        "bot": bot_info,
        "runtime": runtime,
        "license": get_license_status(),
        "paths": {
            "repo": str(REPO_DIR),
            "db": str(storage.db_path),
            "logs": str(logs_dir()),
            "audit": str(audit_path()),
            "runtime": str(runtime_path),
            "events": str(events_path()),
        },
        "risk_daily": {
            "day_utc": risk.day_utc,
            "buy_quote_usdt": risk.buy_quote_usdt,
            "sell_quote_usdt": risk.sell_quote_usdt,
            "realized_pnl_usdt": risk.realized_pnl_usdt,
            "fees_usdt": risk.fees_usdt,
            "orders_count": risk.orders_count,
            "executions_count": risk.executions_count,
            "drawdown_usdt_est": risk.drawdown_usdt_est,
        },
        "events": bus.stats(),
        "flags": flags,
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
        _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)
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
        _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)
        # fallback: se o par não existir, retorna 0 e o front lida com isso
        return {"symbol": "USDTBRL", "price": 0.0}


@app.get("/api/portfolio")
def portfolio() -> dict[str, Any]:
    return {"rows": _read_portfolio(), "path": str(_PORTFOLIO_PATH)}


@app.get("/api/portfolio/valued")
def portfolio_valued() -> dict[str, Any]:
    """
    Carteira manual (portfolio.json) com precificaÃ§Ã£o pÃºblica (pares USDT + USDTBRL).
    NÃ£o exige API_KEY/API_SECRET.
    """
    cache_key = "portfolio:valued"
    cached = _cache_get(cache_key, ttl_s=6.0)
    if cached is not None:
        return cached

    rows_in = _read_portfolio()
    if not rows_in:
        out = {
            "enabled": False,
            "message": "Sem carteira manual. Adicione ativos em Painel de Controle → Saldo (inteligente).",
            "rows": [],
            "total_usdt": 0.0,
            "total_brl": None,
        }
        _cache_set(cache_key, out)
        return out

    fx = usdtbrl()
    usdt_brl = float(fx.get("price") or 0.0) or 0.0

    holdings: list[dict[str, Any]] = []
    total_usdt = 0.0
    unvalued = 0
    for it in rows_in:
        asset = str(it.get("asset") or "").strip().upper()
        qty = float(it.get("qty") or 0.0)
        if not asset or qty <= 0:
            continue
        item: dict[str, Any] = {"asset": asset, "qty": qty}
        if asset == "USDT":
            item["price_usdt"] = 1.0
            item["value_usdt"] = qty
            total_usdt += qty
        else:
            px = _public_price(f"{asset}USDT")
            if px is None:
                item["price_usdt"] = None
                item["value_usdt"] = None
                item["unvalued_reason"] = "Sem par {ASSET}USDT (ou indisponÃ­vel)."
                unvalued += 1
            else:
                item["price_usdt"] = px
                item["value_usdt"] = qty * px
                total_usdt += float(item["value_usdt"])

        if usdt_brl > 0 and item.get("value_usdt") is not None:
            item["value_brl"] = float(item["value_usdt"]) * usdt_brl
        else:
            item["value_brl"] = None

        holdings.append(item)

    holdings.sort(key=lambda x: float(x.get("value_usdt") or 0.0), reverse=True)
    total_brl = total_usdt * usdt_brl if usdt_brl > 0 else None

    out = {
        "enabled": True,
        "fx": fx,
        "rows": holdings,
        "total_usdt": total_usdt,
        "total_brl": total_brl,
        "unvalued_count": unvalued,
        "note": "Estimativa: precifica por pares USDT + USDTBRL. Alguns ativos podem nÃ£o ter par direto.",
        "path": str(_PORTFOLIO_PATH),
    }
    _cache_set(cache_key, out)
    return out


@app.post("/api/portfolio/save")
def portfolio_save(payload: dict[str, Any], request: Request, token: str | None = None) -> dict[str, Any]:
    _require_token(request, token)
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
        _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)
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
        _METRICS["api_failures_total"] = float(_METRICS.get("api_failures_total", 0.0) + 1.0)
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
    _require_token(request, token)
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
    _require_token(request, token)
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
    _require_token(request, token)
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


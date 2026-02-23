from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .paths import data_dir


_REGISTRY_PATH = data_dir() / "symbol_registry.json"


def _now_utc_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def _utc_date_key(iso_z: str | None = None) -> str:
    if iso_z:
        try:
            dt = datetime.fromisoformat(str(iso_z).replace("Z", "+00:00"))
            return dt.astimezone(timezone.utc).strftime("%Y-%m-%d")
        except Exception:
            pass
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _epoch(iso_z: str | None) -> float | None:
    if not iso_z:
        return None
    try:
        dt = datetime.fromisoformat(str(iso_z).replace("Z", "+00:00"))
        return dt.astimezone(timezone.utc).timestamp()
    except Exception:
        return None


def _default_registry() -> dict[str, Any]:
    return {
        # approved pode ser lista de strings (legado) ou lista de dicts {symbol, approved_at_utc, expires_at_utc, permanent}
        "approved": [],
        "rejected": [],
        "pending": [],
        "daily_proposals": {},
        "last_proposed_at": {},
        "updated_at_utc": _now_utc_iso(),
    }


def load_registry() -> dict[str, Any]:
    try:
        if not _REGISTRY_PATH.exists():
            return _default_registry()
        raw = json.loads(_REGISTRY_PATH.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return _default_registry()
        approved_raw = raw.get("approved") if isinstance(raw.get("approved"), list) else []
        rejected = raw.get("rejected") if isinstance(raw.get("rejected"), list) else []
        pending = raw.get("pending") if isinstance(raw.get("pending"), list) else []
        daily = raw.get("daily_proposals") if isinstance(raw.get("daily_proposals"), dict) else {}
        last = raw.get("last_proposed_at") if isinstance(raw.get("last_proposed_at"), dict) else {}

        approved: list[dict[str, Any]] = []
        for a in approved_raw:
            if isinstance(a, str):
                sym = a.strip().upper()
                if sym:
                    approved.append({"symbol": sym, "permanent": True, "approved_at_utc": None, "expires_at_utc": None})
                continue
            if isinstance(a, dict):
                sym = str(a.get("symbol") or "").strip().upper()
                if not sym:
                    continue
                approved.append(
                    {
                        "symbol": sym,
                        "permanent": bool(a.get("permanent", False)),
                        "approved_at_utc": a.get("approved_at_utc"),
                        "expires_at_utc": a.get("expires_at_utc"),
                        "note": a.get("note"),
                    }
                )

        # limpa expirados no load (mantém registro persistido via save_registry quando alguma operação ocorrer)
        now = time.time()
        approved_active: list[dict[str, Any]] = []
        for a in approved:
            if a.get("permanent"):
                approved_active.append(a)
                continue
            exp = _epoch(a.get("expires_at_utc"))
            if exp is None or exp > now:
                approved_active.append(a)

        # normaliza daily_proposals (mantém últimos 30 dias)
        keep = {}
        try:
            for k, v in daily.items():
                if not isinstance(k, str):
                    continue
                if not str(k).strip():
                    continue
                keep[str(k)] = int(v or 0)
        except Exception:
            keep = {}
        if keep:
            keys = sorted(keep.keys())
            if len(keys) > 40:
                for k in keys[:-40]:
                    keep.pop(k, None)

        return {
            "approved": approved_active,
            "rejected": [str(x).upper() for x in rejected if str(x).strip()],
            "pending": [x for x in pending if isinstance(x, dict) and str(x.get("symbol") or "").strip()],
            "daily_proposals": keep,
            "last_proposed_at": {str(k).strip().upper(): str(v) for k, v in last.items() if str(k).strip() and str(v).strip()},
            "updated_at_utc": str(raw.get("updated_at_utc") or _now_utc_iso()),
        }
    except Exception:
        return _default_registry()


def save_registry(reg: dict[str, Any]) -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    approved_out: list[dict[str, Any]] = []
    for a in reg.get("approved") or []:
        if isinstance(a, str):
            sym = a.strip().upper()
            if sym:
                approved_out.append({"symbol": sym, "permanent": True, "approved_at_utc": None, "expires_at_utc": None})
            continue
        if isinstance(a, dict):
            sym = str(a.get("symbol") or "").strip().upper()
            if not sym:
                continue
            approved_out.append(
                {
                    "symbol": sym,
                    "permanent": bool(a.get("permanent", False)),
                    "approved_at_utc": a.get("approved_at_utc"),
                    "expires_at_utc": a.get("expires_at_utc"),
                    "note": a.get("note"),
                }
            )
    # unique por symbol, mantendo o que tem expires/permanent
    by_sym: dict[str, dict[str, Any]] = {}
    for a in approved_out:
        by_sym[str(a["symbol"]).upper()] = a
    approved_out = [by_sym[k] for k in sorted(by_sym.keys())]

    out = {
        "approved": approved_out,
        "rejected": sorted(set([str(x).upper() for x in (reg.get("rejected") or []) if str(x).strip()])),
        "pending": reg.get("pending") or [],
        "daily_proposals": reg.get("daily_proposals") or {},
        "last_proposed_at": reg.get("last_proposed_at") or {},
        "updated_at_utc": _now_utc_iso(),
    }
    _REGISTRY_PATH.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")


def registry_path() -> Path:
    return _REGISTRY_PATH


def approved_symbols() -> set[str]:
    reg = load_registry()
    out: set[str] = set()
    now = time.time()
    for a in reg.get("approved") or []:
        if isinstance(a, str):
            if a.strip():
                out.add(a.strip().upper())
            continue
        if isinstance(a, dict):
            sym = str(a.get("symbol") or "").strip().upper()
            if not sym:
                continue
            if bool(a.get("permanent")):
                out.add(sym)
                continue
            exp = _epoch(a.get("expires_at_utc"))
            if exp is None or exp > now:
                out.add(sym)
    return out


def pending_items() -> list[dict[str, Any]]:
    reg = load_registry()
    items = reg.get("pending") or []
    out: list[dict[str, Any]] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        sym = str(it.get("symbol") or "").strip().upper()
        if not sym:
            continue
        out.append({**it, "symbol": sym})
    return out


def propose_symbol(
    *,
    symbol: str,
    score: float,
    confidence: float,
    explain: list[str] | None,
    signals: dict[str, Any] | None,
    source: str = "discovery",
    max_per_day: int = 3,
    cooldown_hours: float = 24.0,
) -> bool:
    sym = str(symbol or "").strip().upper()
    if not sym:
        return False

    reg = load_registry()
    approved = approved_symbols()
    rejected = set(reg.get("rejected") or [])
    pending = reg.get("pending") or []

    if sym in approved or sym in rejected:
        return False
    if any(str(it.get("symbol") or "").strip().upper() == sym for it in pending if isinstance(it, dict)):
        return False

    # Limite diário (mesmo se aprovar/rejeitar, não spamma no mesmo dia)
    day = _utc_date_key()
    daily = reg.get("daily_proposals") if isinstance(reg.get("daily_proposals"), dict) else {}
    cur_day_count = int(daily.get(day) or 0)
    if int(max_per_day) > 0 and cur_day_count >= int(max_per_day):
        return False

    # Cooldown por símbolo
    last_map = reg.get("last_proposed_at") if isinstance(reg.get("last_proposed_at"), dict) else {}
    last_ts = _epoch(last_map.get(sym))
    if last_ts is not None and (time.time() - last_ts) < float(cooldown_hours) * 3600.0:
        return False

    item = {
        "symbol": sym,
        "score": float(score),
        "confidence": float(confidence),
        "why": (explain or [])[:6],
        "signals": signals or {},
        "source": str(source or "discovery"),
        "ts_utc": _now_utc_iso(),
    }
    pending.append(item)
    reg["pending"] = pending
    daily[day] = cur_day_count + 1
    reg["daily_proposals"] = daily
    last_map[sym] = _now_utc_iso()
    reg["last_proposed_at"] = last_map
    save_registry(reg)
    return True


def decide_symbol(*, symbol: str, decision: str, ttl_hours: float | None = None, permanent: bool = False) -> dict[str, Any]:
    sym = str(symbol or "").strip().upper()
    dec = str(decision or "").strip().lower()
    if not sym:
        return {"ok": False, "error": "missing_symbol"}
    if dec not in {"approve", "reject"}:
        return {"ok": False, "error": "invalid_decision"}

    reg = load_registry()
    approved = [a for a in (reg.get("approved") or []) if isinstance(a, dict) or isinstance(a, str)]
    rejected = set(reg.get("rejected") or [])
    pending = [it for it in (reg.get("pending") or []) if isinstance(it, dict)]

    pending = [it for it in pending if str(it.get("symbol") or "").strip().upper() != sym]
    if dec == "approve":
        # remove versões antigas do mesmo símbolo
        approved = [a for a in approved if (str(a).strip().upper() if isinstance(a, str) else str(a.get("symbol") or "").strip().upper()) != sym]

        perm = bool(permanent)
        ttl = float(ttl_hours) if ttl_hours is not None else 24.0
        approved_at = _now_utc_iso()
        expires_at = None
        if not perm and ttl > 0:
            exp_epoch = time.time() + ttl * 3600.0
            expires_at = datetime.fromtimestamp(exp_epoch, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

        approved.append(
            {
                "symbol": sym,
                "permanent": perm,
                "approved_at_utc": approved_at,
                "expires_at_utc": expires_at,
            }
        )
        rejected.discard(sym)
    else:
        rejected.add(sym)
        approved = [a for a in approved if (str(a).strip().upper() if isinstance(a, str) else str(a.get("symbol") or "").strip().upper()) != sym]

    reg["approved"] = approved
    reg["rejected"] = sorted(rejected)
    reg["pending"] = pending
    save_registry(reg)
    return {"ok": True, "symbol": sym, "decision": dec}

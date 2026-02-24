from __future__ import annotations

import json
import time
from typing import Any

from .paths import data_dir


def _utc_now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def kill_switch_path() -> str:
    return str(data_dir() / "kill_switch.json")


def read_kill_switch() -> dict[str, Any]:
    try:
        p = data_dir() / "kill_switch.json"
        if not p.exists():
            return {"enabled": False}
        raw = json.loads(p.read_text(encoding="utf-8"))
        if not isinstance(raw, dict):
            return {"enabled": False}
        return {"enabled": bool(raw.get("enabled", False)), **raw}
    except Exception:
        return {"enabled": False}


def write_kill_switch(state: dict[str, Any]) -> dict[str, Any]:
    data_dir().mkdir(parents=True, exist_ok=True)
    p = data_dir() / "kill_switch.json"
    safe = dict(state or {})
    safe.setdefault("updated_at_utc", _utc_now_iso())
    if "enabled" not in safe:
        safe["enabled"] = False
    p.write_text(json.dumps(safe, ensure_ascii=False, indent=2), encoding="utf-8")
    return safe


def engage_kill_switch(*, reason: str, source: str = "auto") -> dict[str, Any]:
    cur = read_kill_switch()
    if cur.get("enabled"):
        return cur
    return write_kill_switch(
        {
            "enabled": True,
            "engaged_at_utc": _utc_now_iso(),
            "reason": str(reason),
            "source": str(source),
        }
    )


def clear_kill_switch(*, source: str = "manual") -> dict[str, Any]:
    cur = read_kill_switch()
    if not cur.get("enabled"):
        return cur
    return write_kill_switch(
        {
            "enabled": False,
            "cleared_at_utc": _utc_now_iso(),
            "source": str(source),
        }
    )


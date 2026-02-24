from __future__ import annotations

import json
import time
from hashlib import sha256
from typing import Any

from .paths import data_dir


def _utc_now_iso() -> str:
    # formato simples e ordenável
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def audit_path() -> str:
    return str(data_dir() / "audit.jsonl")


def _token_fingerprint(token: str | None) -> str | None:
    if not token:
        return None
    try:
        h = sha256(token.encode("utf-8", errors="ignore")).hexdigest()
        return h[:12]
    except Exception:
        return None


def append_audit_event(
    *,
    event: str,
    detail: dict[str, Any] | None = None,
    token: str | None = None,
    client_host: str | None = None,
) -> None:
    try:
        data_dir().mkdir(parents=True, exist_ok=True)
        row = {
            "ts_utc": _utc_now_iso(),
            "event": str(event),
            "client_host": client_host,
            "token_fp": _token_fingerprint(token),
            "detail": detail or {},
        }
        p = data_dir() / "audit.jsonl"
        with p.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")
    except Exception:
        # auditoria nunca deve quebrar o sistema
        return

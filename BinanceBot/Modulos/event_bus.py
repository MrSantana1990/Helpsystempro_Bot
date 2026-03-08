from __future__ import annotations

import json
import threading
from collections import deque
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import load_settings
from .paths import data_dir


def _utc_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class BotEvent:
    ts_utc: str
    event_type: str
    severity: str
    symbol: str | None
    payload: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "ts_utc": self.ts_utc,
            "event_type": self.event_type,
            "severity": self.severity,
            "symbol": self.symbol,
            "payload": self.payload,
        }


class EventBus:
    def __init__(self, path: Path, history_limit: int = 500) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._history = deque(maxlen=max(50, int(history_limit)))
        self._lock = threading.Lock()

    def publish(
        self,
        event_type: str,
        payload: dict[str, Any] | None = None,
        *,
        severity: str = "info",
        symbol: str | None = None,
    ) -> dict[str, Any]:
        event = BotEvent(
            ts_utc=_utc_iso(),
            event_type=str(event_type or "unknown"),
            severity=str(severity or "info"),
            symbol=(str(symbol).upper() if symbol else None),
            payload=dict(payload or {}),
        )
        obj = event.to_dict()
        line = json.dumps(obj, ensure_ascii=False)
        with self._lock:
            self._history.append(obj)
            try:
                with self.path.open("a", encoding="utf-8") as f:
                    f.write(line + "\n")
            except Exception:
                pass
        return obj

    def recent(self, limit: int = 100, *, event_type: str | None = None) -> list[dict[str, Any]]:
        lim = max(1, min(int(limit), 1000))
        with self._lock:
            items = list(self._history)
        if event_type:
            et = str(event_type).strip().lower()
            items = [it for it in items if str(it.get("event_type") or "").lower() == et]
        return items[-lim:][::-1]

    def stats(self) -> dict[str, Any]:
        with self._lock:
            items = list(self._history)
        by_type: dict[str, int] = {}
        by_severity: dict[str, int] = {}
        for item in items:
            t = str(item.get("event_type") or "unknown")
            s = str(item.get("severity") or "info")
            by_type[t] = int(by_type.get(t, 0) + 1)
            by_severity[s] = int(by_severity.get(s, 0) + 1)
        return {
            "path": str(self.path),
            "in_memory": len(items),
            "last_event_utc": (items[-1].get("ts_utc") if items else None),
            "by_type": by_type,
            "by_severity": by_severity,
        }


_BUS_SINGLETON: EventBus | None = None


def events_path() -> Path:
    return data_dir() / "events.jsonl"


def get_event_bus() -> EventBus:
    global _BUS_SINGLETON
    if _BUS_SINGLETON is None:
        settings = load_settings()
        history_limit = int(settings.get("event_bus_history_limit", 500) or 500)
        _BUS_SINGLETON = EventBus(events_path(), history_limit=history_limit)
    return _BUS_SINGLETON

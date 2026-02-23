from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import pandas as pd

from .config import load_settings
from .paths import data_dir, ensure_dirs, repo_dir


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class DecisionRecord:
    ts_utc: str
    symbol: str
    action: str  # BUY | HOLD | AVOID | SELL (futuro)
    score: float
    confidence: float
    details: dict[str, Any]


@dataclass(frozen=True)
class TradeRecord:
    ts_utc: str
    symbol: str
    side: str  # BUY | SELL
    qty: float
    price: float
    quote_qty: float
    status: str
    order_id: str | None
    raw: dict[str, Any]


class Storage:
    def __init__(self, db_path: Path | None = None) -> None:
        ensure_dirs()
        settings = load_settings()
        default_path = data_dir() / "trading.sqlite3"
        configured = settings.get("db_path")
        candidate = Path(db_path or configured or default_path)
        if not candidate.is_absolute():
            candidate = repo_dir() / candidate
        self.db_path = candidate
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        con = sqlite3.connect(self.db_path, check_same_thread=False)
        con.execute("PRAGMA journal_mode=WAL;")
        con.execute("PRAGMA foreign_keys=ON;")
        return con

    def _init_db(self) -> None:
        with self._connect() as con:
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS decisions (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  ts_utc TEXT NOT NULL,
                  symbol TEXT NOT NULL,
                  action TEXT NOT NULL,
                  score REAL NOT NULL,
                  confidence REAL NOT NULL,
                  details_json TEXT NOT NULL
                );
                """
            )
            con.execute(
                """
                CREATE TABLE IF NOT EXISTS trades (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  ts_utc TEXT NOT NULL,
                  symbol TEXT NOT NULL,
                  side TEXT NOT NULL,
                  qty REAL NOT NULL,
                  price REAL NOT NULL,
                  quote_qty REAL NOT NULL,
                  status TEXT NOT NULL,
                  order_id TEXT,
                  raw_json TEXT NOT NULL
                );
                """
            )

    def record_decision(self, record: DecisionRecord) -> None:
        with self._connect() as con:
            con.execute(
                """
                INSERT INTO decisions (ts_utc, symbol, action, score, confidence, details_json)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    record.ts_utc,
                    record.symbol,
                    record.action,
                    record.score,
                    record.confidence,
                    json.dumps(record.details, ensure_ascii=False),
                ),
            )

    def record_trade(self, record: TradeRecord) -> None:
        with self._connect() as con:
            con.execute(
                """
                INSERT INTO trades (ts_utc, symbol, side, qty, price, quote_qty, status, order_id, raw_json)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    record.ts_utc,
                    record.symbol,
                    record.side,
                    record.qty,
                    record.price,
                    record.quote_qty,
                    record.status,
                    record.order_id,
                    json.dumps(record.raw, ensure_ascii=False),
                ),
            )

    def trades_df(self, limit: int = 2000) -> pd.DataFrame:
        with self._connect() as con:
            return pd.read_sql_query(
                "SELECT * FROM trades ORDER BY id DESC LIMIT ?",
                con,
                params=(limit,),
            )

    def open_symbols(self) -> set[str]:
        """
        Heurística simples:
        - Se o último trade do símbolo foi BUY => considera posição aberta.
        - Se foi SELL => considera fechada.
        """
        with self._connect() as con:
            rows = con.execute(
                """
                SELECT t.symbol, t.side
                FROM trades t
                JOIN (
                  SELECT symbol, MAX(id) AS max_id
                  FROM trades
                  GROUP BY symbol
                ) last ON last.symbol = t.symbol AND last.max_id = t.id
                """
            ).fetchall()
        return {symbol for symbol, side in rows if str(side).upper() == "BUY"}

    def decisions_df(self, limit: int = 2000) -> pd.DataFrame:
        with self._connect() as con:
            return pd.read_sql_query(
                "SELECT * FROM decisions ORDER BY id DESC LIMIT ?",
                con,
                params=(limit,),
            )

    def export_trades_csv(self, path: Path) -> None:
        df = self.trades_df(limit=100000)
        path.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(path, index=False, encoding="utf-8")


def make_decision(
    *,
    symbol: str,
    action: str,
    score: float,
    confidence: float,
    details: dict[str, Any],
) -> DecisionRecord:
    return DecisionRecord(
        ts_utc=_utc_now_iso(),
        symbol=symbol,
        action=action,
        score=score,
        confidence=confidence,
        details=details,
    )


def make_trade(
    *,
    symbol: str,
    side: str,
    qty: float,
    price: float,
    quote_qty: float,
    status: str,
    order_id: str | None,
    raw: dict[str, Any],
) -> TradeRecord:
    return TradeRecord(
        ts_utc=_utc_now_iso(),
        symbol=symbol,
        side=side,
        qty=qty,
        price=price,
        quote_qty=quote_qty,
        status=status,
        order_id=order_id,
        raw=raw,
    )

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import re
import sys
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


def _repo_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def _portal_dir() -> Path:
    return _repo_dir() / "portal"


def _ensure_imports() -> None:
    # Permite `from Modulos...` quando rodar o server do repo root.
    bot_dir = _repo_dir() / "BinanceBot"
    if str(bot_dir) not in sys.path:
        sys.path.insert(0, str(bot_dir))


# garante que `Modulos` seja importável mesmo quando o Handler é usado via import
_ensure_imports()


def _json_response(handler: BaseHTTPRequestHandler, obj, status: int = 200) -> None:
    data = json.dumps(obj, ensure_ascii=False, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


def _text_response(handler: BaseHTTPRequestHandler, text: str, status: int = 200) -> None:
    data = text.encode("utf-8", errors="replace")
    handler.send_response(status)
    handler.send_header("Content-Type", "text/plain; charset=utf-8")
    handler.send_header("Content-Length", str(len(data)))
    handler.send_header("Cache-Control", "no-store")
    handler.end_headers()
    handler.wfile.write(data)


class Handler(BaseHTTPRequestHandler):
    server_version = "HelpSystemPortal/1.0"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path or "/"
        qs = parse_qs(parsed.query or "")

        if path.startswith("/api/"):
            self._handle_api(path, qs)
            return

        self._handle_static(path)

    def log_message(self, fmt: str, *args) -> None:
        # menos barulho no terminal
        return

    def _handle_api(self, path: str, qs: dict) -> None:
        from Modulos.config import load_settings
        from Modulos.paths import logs_dir
        from Modulos.storage import Storage

        storage = Storage()
        settings = load_settings()

        if path == "/api/health":
            _json_response(self, {"ok": True})
            return

        if path == "/api/overview":
            decisions = storage.decisions_df(limit=1)
            trades = storage.trades_df(limit=1)
            _json_response(
                self,
                {
                    "testnet": bool(settings.get("testnet", True)),
                    "db_path": str(storage.db_path),
                    "counts": {
                        "decisions": int(storage.decisions_df(limit=1000000).shape[0]),
                        "trades": int(storage.trades_df(limit=1000000).shape[0]),
                        "open_positions": len(storage.open_symbols()),
                    },
                    "latest": {
                        "decision_ts": None if decisions.empty else str(decisions.iloc[0]["ts_utc"]),
                        "trade_ts": None if trades.empty else str(trades.iloc[0]["ts_utc"]),
                    },
                    "symbols": settings.get("moedas_monitoradas", []) or [],
                },
            )
            return

        if path == "/api/settings":
            _json_response(self, settings)
            return

        if path == "/api/trades":
            limit = int((qs.get("limit") or ["200"])[0])
            df = storage.trades_df(limit=min(max(limit, 1), 5000))
            _json_response(self, {"rows": df.to_dict(orient="records")})
            return

        if path == "/api/decisions":
            limit = int((qs.get("limit") or ["200"])[0])
            df = storage.decisions_df(limit=min(max(limit, 1), 5000))
            _json_response(self, {"rows": df.to_dict(orient="records")})
            return

        if path == "/api/logs":
            max_lines = int((qs.get("lines") or ["300"])[0])
            max_lines = min(max(max_lines, 10), 5000)
            log_path = logs_dir() / "trading_bot.log"
            if not log_path.exists():
                _json_response(self, {"path": str(log_path), "lines": []})
                return
            lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
            _json_response(self, {"path": str(log_path), "lines": lines[-max_lines:]})
            return

        _json_response(self, {"error": "not_found", "path": path}, status=404)

    def _handle_static(self, path: str) -> None:
        root = _portal_dir()
        if path in {"", "/"}:
            path = "/index.html"

        # bloqueia traversal
        if ".." in path or "\\" in path:
            _text_response(self, "Bad path", status=400)
            return

        file_path = (root / path.lstrip("/")).resolve()
        if root not in file_path.parents and file_path != root:
            _text_response(self, "Bad path", status=400)
            return

        if file_path.is_dir():
            file_path = file_path / "index.html"

        if not file_path.exists():
            # SPA fallback
            file_path = root / "index.html"

        ctype, _ = mimetypes.guess_type(str(file_path))
        ctype = ctype or "application/octet-stream"
        data = file_path.read_bytes()

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)


def main() -> None:
    _ensure_imports()

    ap = argparse.ArgumentParser(description="HelpSystem Portal (local) - Bot UI + API")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8501)
    ap.add_argument("--mock", action="store_true", help="Gera dados fictícios no SQLite ao iniciar.")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    if args.mock:
        from Modulos.storage import Storage
        from Modulos.mock_data import generate_mock

        generate_mock(Storage(), seed=int(args.seed))

    httpd = ThreadingHTTPServer((args.host, int(args.port)), Handler)
    print(f"HelpSystem Portal: http://{args.host}:{args.port}")
    httpd.serve_forever()


if __name__ == "__main__":
    main()

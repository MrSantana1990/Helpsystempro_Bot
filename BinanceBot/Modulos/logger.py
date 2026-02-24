import logging
import os
import re
import time
from logging.handlers import TimedRotatingFileHandler

from .config import load_settings
from .config import load_env
from .paths import ensure_dirs, logs_dir

_REDACT_KEYS = [
    "API_KEY",
    "API_SECRET",
    "NEWS_API_KEY",
    "TELEGRAM_API_KEY",
    "TELEGRAM_CHAT_ID",
    "GITHUB_TOKEN",
    "HSP_PORTAL_TOKEN",
    "JWT_SECRET",
]


class SecretRedactionFilter(logging.Filter):
    def __init__(self) -> None:
        super().__init__()
        self._last_refresh = 0.0
        self._secrets: list[str] = []

    def _refresh(self) -> None:
        now = time.time()
        if (now - self._last_refresh) < 5.0 and self._secrets:
            return
        vals: list[str] = []
        for k in _REDACT_KEYS:
            v = os.getenv(k)
            if v:
                vals.append(str(v))
        try:
            env = load_env()
            for v in [env.api_key, env.api_secret, env.news_api_key, env.telegram_api_key, env.telegram_chat_id]:
                if v:
                    vals.append(str(v))
        except Exception:
            pass
        # mantém somente segredos com tamanho "real"
        self._secrets = [v for v in vals if isinstance(v, str) and len(v) >= 8]
        self._last_refresh = now

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            self._refresh()
            msg = record.getMessage()

            # Redação por padrões key=value
            msg = re.sub(
                r"(?i)\\b(" + "|".join(re.escape(k) for k in _REDACT_KEYS) + r")\\s*[=:]\\s*([^\\s,;]+)",
                r"\\1=[REDACTED]",
                msg,
            )
            # Redação por valores conhecidos
            for s in self._secrets:
                if s and s in msg:
                    msg = msg.replace(s, "[REDACTED]")

            record.msg = msg
            record.args = ()
        except Exception:
            # Nunca quebra log por redaction
            return True
        return True


def configurar_logger():
    ensure_dirs()
    settings = load_settings()
    logger = logging.getLogger()
    level_name = str(settings.get("logs", {}).get("nivel", "INFO")).upper()
    level = getattr(logging, level_name, logging.INFO)
    logger.setLevel(level)

    # Rotação automática diária
    handler = TimedRotatingFileHandler(
        str(logs_dir() / "trading_bot.log"),
        when="midnight",
        interval=1,
        backupCount=int(settings.get("logs", {}).get("backup_logs", 7)),
        encoding="utf-8"
    )
    handler.suffix = "%Y-%m-%d"
    handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    handler.addFilter(SecretRedactionFilter())

    # Log na tela (console)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))
    console_handler.addFilter(SecretRedactionFilter())

    # Adicionar handlers
    file_path = str(logs_dir() / "trading_bot.log")
    has_file = any(
        isinstance(h, TimedRotatingFileHandler) and getattr(h, "baseFilename", "") == file_path for h in logger.handlers
    )
    has_console = any(isinstance(h, logging.StreamHandler) for h in logger.handlers)

    if not has_file:
        logger.addHandler(handler)
    if not has_console:
        logger.addHandler(console_handler)

    return logger

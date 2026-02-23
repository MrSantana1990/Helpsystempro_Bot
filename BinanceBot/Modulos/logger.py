import logging
from logging.handlers import TimedRotatingFileHandler

from .config import load_settings
from .paths import ensure_dirs, logs_dir

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

    # Log na tela (console)
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

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

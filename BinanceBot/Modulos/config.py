from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

from .paths import config_dir


@dataclass(frozen=True)
class Env:
    api_key: str | None
    api_secret: str | None
    telegram_api_key: str | None
    telegram_chat_id: str | None
    news_api_key: str | None
    github_token: str | None


def _read_yaml(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f"Arquivo de config não encontrado: {path}")
    with path.open("r", encoding="utf-8") as f:
        raw = yaml.safe_load(f) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"Config inválida (esperado YAML dict): {path}")
    return raw


@lru_cache(maxsize=1)
def load_settings() -> dict[str, Any]:
    return _read_yaml(config_dir() / "settings.yml")


@lru_cache(maxsize=1)
def load_env() -> Env:
    # Carrega do arquivo local (não versionar). Também permite sobrescrever por env var do SO.
    load_dotenv(config_dir() / "key.env", override=True)
    return Env(
        api_key=os.getenv("API_KEY"),
        api_secret=os.getenv("API_SECRET"),
        telegram_api_key=os.getenv("TELEGRAM_API_KEY"),
        telegram_chat_id=os.getenv("TELEGRAM_CHAT_ID"),
        news_api_key=os.getenv("NEWS_API_KEY"),
        github_token=os.getenv("GITHUB_TOKEN"),
    )

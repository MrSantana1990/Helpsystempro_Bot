from __future__ import annotations

from pathlib import Path


def bot_dir() -> Path:
    return Path(__file__).resolve().parents[1]


def repo_dir() -> Path:
    return bot_dir().parent


def config_dir() -> Path:
    return bot_dir() / "Configs"


def data_dir() -> Path:
    return repo_dir() / "data"


def logs_dir() -> Path:
    return repo_dir() / "logs"


def ensure_dirs() -> None:
    data_dir().mkdir(parents=True, exist_ok=True)
    logs_dir().mkdir(parents=True, exist_ok=True)


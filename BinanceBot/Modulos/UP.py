from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path

import requests
import yaml

from .config import load_env
from .paths import config_dir


@dataclass(frozen=True)
class UpConfig:
    repo_name: str
    repo_dir: Path
    branch: str


def load_up_config() -> UpConfig:
    path = config_dir() / "up_config.yml"
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    repo_name = str(raw.get("repo_name") or "").strip()
    repo_dir = Path(str(raw.get("repo_dir") or "")).expanduser()
    branch = str(raw.get("branch") or "main").strip()
    if not repo_name or "/" not in repo_name:
        raise ValueError("up_config.yml inválido: repo_name deve ser 'owner/repo'.")
    if not repo_dir.exists():
        raise ValueError(f"up_config.yml inválido: repo_dir não existe: {repo_dir}")
    return UpConfig(repo_name=repo_name, repo_dir=repo_dir, branch=branch)


def _run(cmd: str, *, cwd: Path) -> None:
    subprocess.run(cmd, cwd=str(cwd), shell=True, check=True)


def commit_push() -> None:
    cfg = load_up_config()
    msg = input("Mensagem do commit: ").strip()
    if not msg:
        print("Commit cancelado (mensagem vazia).")
        return
    _run("git add -A", cwd=cfg.repo_dir)
    _run(f"git commit -m \"{msg}\"", cwd=cfg.repo_dir)
    _run(f"git push origin {cfg.branch}", cwd=cfg.repo_dir)
    print(f"OK: push para origin/{cfg.branch}.")


def set_visibility(private: bool) -> None:
    cfg = load_up_config()
    token = load_env().github_token
    if not token:
        raise ValueError("GITHUB_TOKEN não configurado em BinanceBot/Configs/key.env")

    url = f"https://api.github.com/repos/{cfg.repo_name}"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
    }

    r = requests.patch(url, json={"private": bool(private)}, headers=headers, timeout=20)
    if r.status_code >= 300:
        raise RuntimeError(f"Falha ao alterar visibilidade: {r.status_code} {r.text[:500]}")
    print("OK: repositório atualizado.")


def check_latest() -> None:
    cfg = load_up_config()
    _run("git fetch origin", cwd=cfg.repo_dir)
    _run(f"git log origin/{cfg.branch} -n 1 --oneline", cwd=cfg.repo_dir)


def menu() -> None:
    print("HelpSystem UP (GitHub)")
    print("1 - Tornar repositório privado")
    print("2 - Tornar repositório público")
    print("3 - Commit e push")
    print("4 - Ver último commit remoto")
    opt = input("Opção: ").strip()

    if opt == "1":
        set_visibility(True)
    elif opt == "2":
        set_visibility(False)
    elif opt == "3":
        commit_push()
    elif opt == "4":
        check_latest()
    else:
        print("Opção inválida.")


if __name__ == "__main__":
    menu()


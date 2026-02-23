from __future__ import annotations

import os
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class ProjectReport:
    root: str
    top_level: list[str]
    manifests: list[str]
    languages: list[tuple[str, int]]
    hints: list[str]
    risks: list[str]


def _list_top(root: Path, limit: int = 80) -> list[str]:
    items = []
    for p in sorted(root.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        items.append(p.name + ("/" if p.is_dir() else ""))
        if len(items) >= limit:
            break
    return items


def _find_manifests(root: Path) -> list[str]:
    names = {
        "README.md",
        "pyproject.toml",
        "requirements.txt",
        "package.json",
        "Dockerfile",
        "docker-compose.yml",
        "docker-compose.yaml",
        ".gitignore",
    }
    found = []
    for name in names:
        p = root / name
        if p.exists():
            found.append(name)
    return sorted(found)


def _count_exts(root: Path, max_files: int = 4000) -> Counter[str]:
    exts: Counter[str] = Counter()
    scanned = 0
    for dirpath, dirnames, filenames in os.walk(root):
        # heurística: ignora dirs comuns
        dirnames[:] = [
            d
            for d in dirnames
            if d not in {".git", ".venv", "node_modules", "__pycache__", "dist", "build", ".next"}
        ]
        for fn in filenames:
            scanned += 1
            if scanned > max_files:
                return exts
            ext = Path(fn).suffix.lower() or "(sem_ext)"
            exts[ext] += 1
    return exts


def analyze_project(root_path: str) -> ProjectReport:
    root = Path(root_path).expanduser().resolve()
    if not root.exists():
        raise FileNotFoundError(f"Diretório não encontrado: {root}")
    if not root.is_dir():
        raise ValueError(f"Não é um diretório: {root}")

    top = _list_top(root)
    manifests = _find_manifests(root)

    exts = _count_exts(root)
    lang_map = {
        ".py": "Python",
        ".js": "JavaScript",
        ".ts": "TypeScript",
        ".tsx": "TypeScript/React",
        ".jsx": "React",
        ".cs": "C#",
        ".java": "Java",
        ".kt": "Kotlin",
        ".go": "Go",
        ".rs": "Rust",
        ".php": "PHP",
        ".sql": "SQL",
    }
    langs: Counter[str] = Counter()
    for ext, count in exts.items():
        if ext in lang_map:
            langs[lang_map[ext]] += count

    hints: list[str] = []
    risks: list[str] = []

    if (root / "package.json").exists():
        hints.append("Projeto Node (package.json encontrado).")
    if (root / "pyproject.toml").exists() or (root / "requirements.txt").exists():
        hints.append("Projeto Python (pyproject/requirements encontrado).")
    if (root / "Dockerfile").exists():
        hints.append("Dockerfile encontrado (provável deploy via container).")

    # riscos básicos e úteis
    if (root / ".env").exists():
        risks.append("Arquivo .env no root: confirme se está no .gitignore e sem segredos expostos.")
    if (root / ".venv").exists():
        risks.append(".venv dentro do repo: normalmente deve ficar no .gitignore (evita commit pesado).")
    if (root / "node_modules").exists():
        risks.append("node_modules dentro do repo: normalmente deve ficar no .gitignore.")

    languages = sorted(langs.items(), key=lambda x: x[1], reverse=True)
    if not languages:
        languages = [("Desconhecido", sum(exts.values()))]

    return ProjectReport(
        root=str(root),
        top_level=top,
        manifests=manifests,
        languages=languages,
        hints=hints or ["Sem heurísticas fortes — precisa olhar entrypoints/manifests."],
        risks=risks,
    )


from __future__ import annotations

import base64
import json
import os
import platform
from dataclasses import dataclass
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from typing import Any

from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15

from .paths import data_dir


# Chave pública embutida (RSA). A private key deve ficar fora do repo (uso do vendedor).
# Você pode trocar a public key via env var `HSP_LICENSE_PUBLIC_KEY_PEM` se necessário,
# mas por padrão este valor é a referência.
PUBLIC_KEY_PEM = """-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAseb8WOluTLM+Zac/Piaf
cTcJMkuPHNNSDaXvO6XOQ/Xhld1vFqa43Lh5a0nLlpdGsuHNQzoYYcQsDZp0NfQL
7FoIeAomgw5kiX5FN6n+b8JyY0WCOQsBW0XuNxnxfhqLCJLwKdr6hkOCvV0gsOeM
7QEkkCyggSLQ278tBI0U8/+mFqXL2sxDG8v+oT1ytQnK3uteqOmJ2iHamf0fT6/4
sdHHVTk/rSjxuXASE0pXd05vvX9cfKTWz83BeJOUgMkRRW40AS7OYQ0g+LLOpjsZ
WPAhxKoa4wUwAf566BfWzFOq8LFkd0XXURQUYT30vnejO2/tu/V6l7/+bUVNd6K2
IwIDAQAB
-----END PUBLIC KEY-----"""


def license_path() -> Path:
    p = os.getenv("HSP_LICENSE_PATH") or os.getenv("LICENSE_PATH") or ""
    if p.strip():
        return Path(p).expanduser().resolve()
    return (data_dir() / "license.json").resolve()


def _parse_iso(ts: str) -> datetime | None:
    s = (ts or "").strip()
    if not s:
        return None
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)
    except Exception:
        return None


def _machine_id_raw() -> str:
    sysname = platform.system().lower()
    if sysname.startswith("win"):
        try:
            import winreg  # type: ignore

            with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography") as k:
                guid, _ = winreg.QueryValueEx(k, "MachineGuid")
                if guid:
                    return f"win:MachineGuid:{guid}"
        except Exception:
            pass

    # Linux
    for p in ["/etc/machine-id", "/var/lib/dbus/machine-id"]:
        try:
            if os.path.exists(p):
                mid = Path(p).read_text(encoding="utf-8", errors="ignore").strip()
                if mid:
                    return f"linux:machine-id:{mid}"
        except Exception:
            pass

    # Fallback (menos estável)
    try:
        node = platform.node() or ""
        ver = platform.version() or ""
        return f"fallback:{node}:{ver}"
    except Exception:
        return "fallback:unknown"


def machine_hash() -> str:
    raw = _machine_id_raw().encode("utf-8", errors="ignore")
    return sha256(raw).hexdigest()


def _public_key_pem() -> str:
    return os.getenv("HSP_LICENSE_PUBLIC_KEY_PEM") or PUBLIC_KEY_PEM


def _canonical_payload_bytes(obj: dict[str, Any]) -> bytes:
    payload = {k: v for k, v in obj.items() if k != "signature"}
    txt = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return txt.encode("utf-8")


@dataclass(frozen=True)
class LicenseStatus:
    valid: bool
    status: str  # active | expired | invalid | missing
    reason: str
    plan: str | None
    expires_at_utc: str | None
    machine_hash_local: str
    machine_hash_expected: str | None
    path: str


def validate_license_obj(obj: dict[str, Any] | None, *, now_utc: datetime | None = None) -> LicenseStatus:
    mh = machine_hash()
    path = str(license_path())
    now = now_utc or datetime.now(timezone.utc)

    if not obj:
        return LicenseStatus(
            valid=False,
            status="missing",
            reason="Licença não encontrada.",
            plan=None,
            expires_at_utc=None,
            machine_hash_local=mh,
            machine_hash_expected=None,
            path=path,
        )

    plan = str(obj.get("plan") or "").strip() or None
    expires_at = str(obj.get("expires_at") or obj.get("expires_at_utc") or "").strip()
    expected_mh = str(obj.get("machine_hash") or "").strip() or None
    sig_b64 = str(obj.get("signature") or "").strip()

    if not plan or not expires_at or not expected_mh or not sig_b64:
        return LicenseStatus(
            valid=False,
            status="invalid",
            reason="Licença inválida: campos obrigatórios ausentes (plan/expires_at/machine_hash/signature).",
            plan=plan,
            expires_at_utc=expires_at or None,
            machine_hash_local=mh,
            machine_hash_expected=expected_mh,
            path=path,
        )

    exp_dt = _parse_iso(expires_at)
    if not exp_dt:
        return LicenseStatus(
            valid=False,
            status="invalid",
            reason="Licença inválida: expires_at inválido (ISO).",
            plan=plan,
            expires_at_utc=expires_at or None,
            machine_hash_local=mh,
            machine_hash_expected=expected_mh,
            path=path,
        )

    if expected_mh.lower() != mh.lower():
        return LicenseStatus(
            valid=False,
            status="invalid",
            reason="Licença inválida: machine_hash não confere com esta máquina.",
            plan=plan,
            expires_at_utc=exp_dt.isoformat().replace("+00:00", "Z"),
            machine_hash_local=mh,
            machine_hash_expected=expected_mh,
            path=path,
        )

    try:
        sig = base64.b64decode(sig_b64.encode("utf-8"), validate=True)
    except Exception:
        return LicenseStatus(
            valid=False,
            status="invalid",
            reason="Licença inválida: assinatura (base64) inválida.",
            plan=plan,
            expires_at_utc=exp_dt.isoformat().replace("+00:00", "Z"),
            machine_hash_local=mh,
            machine_hash_expected=expected_mh,
            path=path,
        )

    try:
        pub = RSA.import_key(_public_key_pem().encode("utf-8"))
        h = SHA256.new(_canonical_payload_bytes(obj))
        pkcs1_15.new(pub).verify(h, sig)
    except Exception:
        return LicenseStatus(
            valid=False,
            status="invalid",
            reason="Licença inválida: assinatura não confere.",
            plan=plan,
            expires_at_utc=exp_dt.isoformat().replace("+00:00", "Z"),
            machine_hash_local=mh,
            machine_hash_expected=expected_mh,
            path=path,
        )

    if exp_dt <= now:
        return LicenseStatus(
            valid=False,
            status="expired",
            reason="Licença expirada.",
            plan=plan,
            expires_at_utc=exp_dt.isoformat().replace("+00:00", "Z"),
            machine_hash_local=mh,
            machine_hash_expected=expected_mh,
            path=path,
        )

    return LicenseStatus(
        valid=True,
        status="active",
        reason="OK",
        plan=plan,
        expires_at_utc=exp_dt.isoformat().replace("+00:00", "Z"),
        machine_hash_local=mh,
        machine_hash_expected=expected_mh,
        path=path,
    )


def read_license_file() -> dict[str, Any] | None:
    p = license_path()
    try:
        if not p.exists():
            return None
        return json.loads(p.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None


def get_license_status() -> dict[str, Any]:
    st = validate_license_obj(read_license_file())
    return {
        "valid": st.valid,
        "status": st.status,
        "reason": st.reason,
        "plan": st.plan,
        "expires_at_utc": st.expires_at_utc,
        "machine_hash_local": st.machine_hash_local,
        "machine_hash_expected": st.machine_hash_expected,
        "path": st.path,
    }


def require_live_license() -> None:
    """
    Bloqueia modo LIVE se licença estiver ausente/inválida/expirada.
    Dry-run e testnet não exigem licença.
    """
    st = validate_license_obj(read_license_file())
    if not st.valid:
        raise ValueError(f"Licença inválida ({st.status}): {st.reason} | machine_hash={st.machine_hash_local}")


def save_license_obj(obj: dict[str, Any]) -> Path:
    p = license_path()
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")
    return p

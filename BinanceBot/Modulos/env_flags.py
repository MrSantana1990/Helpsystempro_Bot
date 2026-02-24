from __future__ import annotations

import os


def env_flag(name: str, default: bool = False) -> bool:
    v = os.getenv(name)
    if v is None:
        return default
    v = str(v).strip().lower()
    if v in {"1", "true", "yes", "y", "on"}:
        return True
    if v in {"0", "false", "no", "n", "off"}:
        return False
    return default


def env_str(name: str, default: str = "") -> str:
    v = os.getenv(name)
    if v is None:
        return default
    return str(v)


def get_runtime_flags() -> dict[str, object]:
    """
    Flags para evoluÃ§Ã£o futura (VPS dedicada / auth), mantendo Local-first por padrÃ£o.

    Aceita tanto nomes genÃ©ricos quanto prefixados:
    - BASE_URL / HSP_BASE_URL
    - ENABLE_AUTH / HSP_ENABLE_AUTH
    - ENABLE_2FA / HSP_ENABLE_2FA
    - LIVE_MODE / HSP_LIVE_MODE
    - LOCAL_ONLY / HSP_LOCAL_ONLY
    """
    base_url = env_str("BASE_URL", "") or env_str("HSP_BASE_URL", "")
    enable_auth = env_flag("ENABLE_AUTH", False) or env_flag("HSP_ENABLE_AUTH", False)
    enable_2fa = env_flag("ENABLE_2FA", False) or env_flag("HSP_ENABLE_2FA", False)
    live_mode = env_flag("LIVE_MODE", False) or env_flag("HSP_LIVE_MODE", False)
    local_only = env_flag("LOCAL_ONLY", True) if os.getenv("HSP_LOCAL_ONLY") is None else env_flag("HSP_LOCAL_ONLY", True)
    return {
        "base_url": base_url,
        "enable_auth": enable_auth,
        "enable_2fa": enable_2fa,
        "live_mode": live_mode,
        "local_only": local_only,
    }


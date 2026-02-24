from __future__ import annotations

import argparse
import base64
import json
from datetime import datetime, timezone
from pathlib import Path

from Crypto.Hash import SHA256
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15

from BinanceBot.Modulos.license import machine_hash as local_machine_hash


def _canonical_payload_bytes(obj: dict) -> bytes:
    payload = {k: v for k, v in obj.items() if k != "signature"}
    txt = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return txt.encode("utf-8")


def cmd_machine_hash() -> int:
    print(local_machine_hash())
    return 0


def cmd_sign(private_key_path: str, plan: str, expires_at: str, machine_hash: str, out_path: str | None) -> int:
    # valida expires_at
    s = expires_at.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
    except Exception as e:
        raise SystemExit(f"expires_at inválido (ISO): {e}")

    payload = {
        "plan": str(plan).strip(),
        "expires_at": expires_at.strip(),
        "machine_hash": str(machine_hash).strip(),
    }

    key = RSA.import_key(Path(private_key_path).read_bytes())
    h = SHA256.new(_canonical_payload_bytes(payload))
    sig = pkcs1_15.new(key).sign(h)
    payload["signature"] = base64.b64encode(sig).decode("utf-8")

    txt = json.dumps(payload, ensure_ascii=False, indent=2)
    if out_path:
        Path(out_path).parent.mkdir(parents=True, exist_ok=True)
        Path(out_path).write_text(txt, encoding="utf-8")
    else:
        print(txt)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="HelpSystempro_Bot — ferramentas de licença (offline).")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("machine-hash", help="Imprime o machine_hash desta máquina.")

    sp = sub.add_parser("sign", help="Assina uma licença com RSA (private key fora do repo).")
    sp.add_argument("--private-key", required=True, help="Caminho do private_key.pem (NÃO comitar no git).")
    sp.add_argument("--plan", required=True, help="Nome do plano (Starter/Pro/Premium).")
    sp.add_argument("--expires-at", required=True, help="ISO UTC (ex: 2026-12-31T00:00:00Z).")
    sp.add_argument("--machine-hash", required=True, help="Machine hash do cliente.")
    sp.add_argument("--out", default="", help="Arquivo de saída (ex: data/license.json). Se vazio, imprime.")

    args = ap.parse_args()
    if args.cmd == "machine-hash":
        return cmd_machine_hash()
    if args.cmd == "sign":
        return cmd_sign(args.private_key, args.plan, args.expires_at, args.machine_hash, args.out or None)
    raise SystemExit("cmd inválido")


if __name__ == "__main__":
    raise SystemExit(main())


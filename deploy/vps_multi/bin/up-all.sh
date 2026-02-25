#!/usr/bin/env bash
set -euo pipefail

base_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Subindo proxy (traefik)..."
docker compose -f "${base_dir}/base/docker-compose.yml" up -d

echo "Subindo tenants..."
for d in "${base_dir}/tenants"/*; do
  name="$(basename "${d}")"
  [[ "${name}" == "_template" ]] && continue
  [[ ! -d "${d}" ]] && continue
  if [[ ! -f "${d}/docker-compose.yml" ]]; then
    continue
  fi
  echo " - ${name}"
  bash "${base_dir}/bin/up-tenant.sh" "${name}"
done

echo "OK: proxy + tenants up"


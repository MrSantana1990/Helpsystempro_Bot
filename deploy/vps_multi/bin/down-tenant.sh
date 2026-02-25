#!/usr/bin/env bash
set -euo pipefail

slug="${1:-}"
if [[ -z "${slug}" ]]; then
  echo "Uso: down-tenant.sh <slug>"
  exit 1
fi

base_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tenant_dir="${base_dir}/tenants/${slug}"
if [[ ! -d "${tenant_dir}" ]]; then
  echo "Tenant não encontrado: ${tenant_dir}"
  exit 1
fi

export TENANT_SLUG="${slug}"
docker compose --env-file "${tenant_dir}/.env" -f "${tenant_dir}/docker-compose.yml" down
echo "OK: tenant ${slug} down"


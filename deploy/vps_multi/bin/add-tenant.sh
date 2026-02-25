#!/usr/bin/env bash
set -euo pipefail

slug="${1:-}"
domain="${2:-}"

if [[ -z "${slug}" || -z "${domain}" ]]; then
  echo "Uso: add-tenant.sh <slug> <dominio>"
  echo "Ex:  add-tenant.sh cliente1 cliente1.seudominio.com"
  exit 1
fi

base_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tenant_dir="${base_dir}/tenants/${slug}"
tpl_dir="${base_dir}/tenants/_template"

if [[ -d "${tenant_dir}" ]]; then
  echo "Tenant já existe: ${tenant_dir}"
  exit 1
fi

mkdir -p "${tenant_dir}"
cp -R "${tpl_dir}/docker-compose.yml" "${tenant_dir}/docker-compose.yml"
cp -R "${tpl_dir}/.env.example" "${tenant_dir}/.env"

mkdir -p "${tenant_dir}/data" "${tenant_dir}/logs" "${tenant_dir}/Configs"

# settings.yml inicial (se não existir)
if [[ ! -f "${tenant_dir}/Configs/settings.yml" ]]; then
  cp "${base_dir}/../../BinanceBot/Configs/settings.yml" "${tenant_dir}/Configs/settings.yml"
fi

# key.env vazio (cliente preencher pelo painel)
touch "${tenant_dir}/Configs/key.env"

sed -i.bak "s|TENANT_DOMAIN=.*|TENANT_DOMAIN=${domain}|g" "${tenant_dir}/.env" && rm -f "${tenant_dir}/.env.bak"

echo "OK: tenant criado em ${tenant_dir}"
echo "Edite: ${tenant_dir}/.env (TENANT_BASIC_AUTH / HSP_PORTAL_TOKEN / flags)"


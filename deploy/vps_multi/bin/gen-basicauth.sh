#!/usr/bin/env bash
set -euo pipefail

user="${1:-}"
pass="${2:-}"

if [[ -z "${user}" || -z "${pass}" ]]; then
  echo "Uso: gen-basicauth.sh <user> <senha>"
  echo "Ex:  gen-basicauth.sh admin \"SENHA_FORTE\""
  exit 1
fi

if command -v htpasswd >/dev/null 2>&1; then
  # -n = print, -b = batch
  line="$(htpasswd -nb "${user}" "${pass}")"
  # Docker labels/compose exigem escapar $ como $$
  echo "${line}" | sed -e 's/\$/\$\$/g'
  exit 0
fi

echo "Erro: htpasswd não encontrado. Instale apache2-utils (Ubuntu) e tente novamente."
echo "Ubuntu: sudo apt-get update && sudo apt-get install -y apache2-utils"
exit 1


#!/usr/bin/env bash
#
# Backup diário do banco. Rode pelo cron do servidor:
#   0 3 * * * /caminho/erp/scripts/backup.sh >> /var/log/soul-backup.log 2>&1
#
# Backup que nunca foi restaurado não é backup: uma vez por mês, restaure o
# arquivo mais recente num banco de teste e confira que o sistema sobe.
set -euo pipefail

cd "$(dirname "$0")/.."
RETENTION_DAYS=${RETENTION_DAYS:-30}
STAMP=$(date +%Y%m%d-%H%M)
FILE="backups/soul-erp-${STAMP}.sql.gz"

mkdir -p backups
echo "→ gerando ${FILE}"
docker compose -f docker-compose.prod.yml exec -T db \
  pg_dump -U "${POSTGRES_USER:-soul}" -d "${POSTGRES_DB:-soul_erp}" \
  | gzip > "${FILE}"

SIZE=$(du -h "${FILE}" | cut -f1)
echo "→ ${FILE} (${SIZE})"

# Um backup vazio é pior que nenhum, porque passa despercebido.
if [ "$(stat -c%s "${FILE}")" -lt 10000 ]; then
  echo "ATENÇÃO: backup suspeito de vazio — verifique o banco" >&2
  exit 1
fi

find backups -name 'soul-erp-*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "→ backups mantidos: $(ls backups | wc -l)"

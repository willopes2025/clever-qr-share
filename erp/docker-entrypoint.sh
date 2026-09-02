#!/usr/bin/env sh
#
# Aplica as migrações antes de subir. Migração é sempre compatível para trás
# (expand → migrate → contract), então rodar isto na subida é seguro mesmo com
# um terminal ainda numa versão anterior do PDV.
set -e

echo "→ aplicando migrações"
npx --yes prisma migrate deploy --schema apps/api/prisma/schema.prisma

echo "→ subindo o Soul ERP"
exec "$@"

#!/usr/bin/env bash
#
# Empacota o Soul ERP para produção: compila os pacotes, as duas aplicações web
# e a API, e junta tudo num único diretório servido por um processo só.
#
#   apps/api/dist      → API compilada
#   apps/api/public/   → retaguarda (/) e PDV (/pdv)
#
# Uso: ./scripts/build-release.sh
set -euo pipefail

cd "$(dirname "$0")/.."
echo "→ pacotes compartilhados"
npm run build -w @soul/money -w @soul/contracts

echo "→ cliente Prisma"
npm run db:generate -w @soul/api

echo "→ API"
npm run build -w @soul/api

echo "→ retaguarda"
VITE_API_URL=/v1 npm run build -w @soul/web

echo "→ PDV"
PDV_BASE=/pdv/ VITE_API_URL=/v1 npm run build -w @soul/pdv

echo "→ juntando o pacote"
rm -rf apps/api/public
mkdir -p apps/api/public
cp -r apps/web/dist apps/api/public/web
cp -r apps/pdv/dist apps/api/public/pdv

echo
echo "Pronto. Para rodar:"
echo "  DATABASE_URL=... JWT_SECRET=... node apps/api/dist/main.js"

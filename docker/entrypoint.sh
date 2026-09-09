#!/bin/sh
set -e

# Aplica migrations pendentes antes de subir a API.
echo "→ prisma migrate deploy"
npx prisma migrate deploy

# Seed idempotente (tabelas de imposto). Não falha o boot se der erro.
if [ "${RUN_SEED:-true}" = "true" ]; then
  echo "→ prisma db seed (idempotente)"
  npx tsx prisma/seed.ts || echo "aviso: seed falhou, seguindo"
fi

exec "$@"

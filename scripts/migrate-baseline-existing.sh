#!/bin/sh
# Bestehende Dev-DB (früher db push) auf die Init-Migration setzen — ohne Reset.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/packages/db"
echo "Markiere 20260830120000_init als bereits angewandt…"
pnpm exec prisma migrate resolve --applied 20260830120000_init
pnpm exec prisma migrate status
echo
echo "Fertig. Nächste Schema-Änderung: pnpm db:migrate"
echo "Nur wenn Daten egal sind: pnpm --filter db exec prisma migrate reset"

#!/bin/sh
set -e
cd /app
# migrate braucht die direkte Postgres-URL, nie prisma:// (Accelerate)
MIGRATE_URL="${DIRECT_DATABASE_URL:-$DATABASE_URL}"
DATABASE_URL="$MIGRATE_URL" node packages/db/prisma-deploy.mjs
exec pnpm --filter web exec next start -H 0.0.0.0 -p 3000

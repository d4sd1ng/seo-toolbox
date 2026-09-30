# Prisma Studio

Lokale Datenanalyse (Tabellen, Filter, Relationen). **Nicht** im Internet exposen, **nicht** in Production-Compose.

```bash
# Postgres läuft
docker compose up -d postgres
cp .env packages/db/.env   # DATABASE_URL
pnpm db:studio
```

Browser: [http://localhost:5555](http://localhost:5555)

Nützliche Modelle: `Project`, `Job`, `Issue`, `OnPageAudit`, `Crawl`, `Session`, `QuotaBucket`.

In `packages/db/package.json`:

```json
"studio": "prisma studio --browser none --port 5555"
```

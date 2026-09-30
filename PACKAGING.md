# Produktstart — ein Befehl

Kunden und interne Demos sehen **kein** zweites Terminal, kein Prisma, kein Redis.

## Produktion / Self-host

```bash
cp .env.example .env
# ENCRYPTION_KEY auf ≥32 Zeichen setzen

docker compose up -d --build
```

Offen: http://localhost:3000
Register → Domain → Audit und Crawl laufen von allein.

Logs:

```bash
docker compose logs -f web worker
```

CI/CD (GHCR + SSH): siehe [DEPLOY.md](DEPLOY.md).

## Entwicklung (ihr)

```bash
docker compose up -d postgres redis
cp .env.example .env
cp .env apps/web/.env
cp .env packages/db/.env
pnpm install
pnpm db:generate && pnpm db:push
pnpm stack          # Web + Worker in einem Prozess
```

`package.json`:

```json
"stack": "node scripts/dev-stack.mjs"
```

## Was der Kunde nie sieht

Queue-Namen, Worker, Redis, Playwright, `db:push`.
Fehlertexte sind Produkt-Sprache („Prüfung fehlgeschlagen“).

# SEO Toolbox – Scaffold

Usability-first: ein Projekt, eine Issue-Inbox, Module als Plugins, Jobs asynchron.

## Start

Google Cloud: Search Console API aktivieren, OAuth-Client (Web) anlegen, Redirect URI `http://localhost:3000/api/integrations/gsc/callback`.

```bash
cd seo-toolbox
cp .env.example .env
# DATABASE_URL, REDIS_URL, ENCRYPTION_KEY, GOOGLE_* setzen
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:push
pnpm --filter db seed
pnpm dev          # Next.js
pnpm dev:worker   # BullMQ Worker (zweites Terminal)
pnpm test         # Caps, Extract, Heuristik
```

Seed schreibt eine Project-ID. Öffne `/p/<id>/gsc`.

## Jobs

1. API legt `Job` in Postgres an und pusht nach Redis (`seo-jobs`).
2. `apps/worker` holt den Job, setzt `running`, ruft den Handler.
3. UI pollt `GET /api/jobs/:id`.

Handler sitzen in `packages/queue/src/process.ts`:

- `onpage_audit` → `runOnPageAudit`
- `gsc_sync` → `runGscSync`
- `site_crawl` → `runSiteCrawl`

Neuer Job-Typ: Enum in Prisma + Case im Worker. API nur noch `enqueueJob()`.

## GSC-Plugin

1. `/api/integrations/gsc/start?projectId=` → Google OAuth (offline, consent).
2. Callback speichert Tokens AES-256-GCM-verschlüsselt in `Integration.credentialsRef`.
3. Property dem Projekt zuordnen (`gscSiteUrl`).
4. Sync zieht 28 Tage (GSC-Lag 3 Tage):
   - Dimension `date` → KPIs
   - `query` / `page` → Listen
   - `query+page` → Issues `ctr_opportunity` und `high_impressions_poor_position`

Leere Strings in `SearchPerformance.query` / `pageUrl` bedeuten „gesamt“, nicht NULL (Unique-Index).

## Crawler

`POST /api/projects/:id/crawls` mit `{ seedUrl, maxUrls, renderJavascript }`.

- BFS, 5 parallele Fetches (2 wenn Render an), robots.txt optional
- Redirects manuell, dann optional Playwright auf der finalen URL
- Hybrid: Seed + leere App-Shells, max. 80 Render-Slots
- Issues inkl. `js_dependent_content` und `render_budget_exhausted`

## Struktur

```
apps/web
apps/worker
packages/queue                 BullMQ + processQueuedJob
packages/modules/onpage
packages/modules/gsc
packages/modules/crawler          HTML-Crawl, robots.txt, Issue-Cluster
packages/core                  priorityScore, encryptJson
packages/db
packages/plugin-sdk
```

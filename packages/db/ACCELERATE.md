# Prisma Accelerate (optional)

Lokal bleibt `DATABASE_URL=postgresql://…`. Accelerate nur, wenn `DATABASE_URL` (oder `ACCELERATE_URL`) mit `prisma://` beginnt.

## Setup

```bash
pnpm --filter db add @prisma/extension-accelerate
```

In `schema.prisma`:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}
```

`.env` (Prisma Console → Accelerate Enable):

```
DATABASE_URL="prisma://…?api_key=…"
DIRECT_DATABASE_URL="postgresql://postgres:…@db-host:5432/seo_toolbox?schema=public"
```

`index.ts` exportiert `prisma` aus `./client` plus `readCache`.

## Cache

Nur Lese-Queries. Jobs/Session **nicht** cachen.

```ts
import { prisma, readCache } from "db";

await prisma.onPageAudit.findFirst({
  where: { projectId },
  orderBy: { fetchedAt: "desc" },
  ...readCache(30),
});
```

Ohne Accelerate ist `readCache()` `{}` — gleicher Code lokal und in Prod.

Migrationen: immer `DIRECT_DATABASE_URL` (web-entrypoint macht das).

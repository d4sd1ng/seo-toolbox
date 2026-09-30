# Prisma-Performance

1. **Pool** — `createPrismaClient()` setzt `connection_limit=10` und `pool_timeout=10` (Env: `PRISMA_CONNECTION_LIMIT`, `PRISMA_POOL_TIMEOUT`). Ein Client pro Prozess (globalThis).
2. **Kein N+1** — Listen mit `Promise.all`, keine Queries in `.map`.
3. **`select`** — nur Felder, die die UI braucht (Übersicht ist umgestellt).
4. **`take`** — immer begrenzen (Inbox 8, Jobs 5, GSC 28).
5. **Indizes** — `ANALYTICS.md` / Migration `analytics_indexes`.
6. **Logging** — langsam ≥ 200 ms (`with-logging.ts`).
7. **`include` meiden**, wenn Relationen nicht gerendert werden.

Web + Worker = zwei Pools. Limit nicht höher als Postgres `max_connections` / Prozesse.

In `src/index.ts`: `export { prisma } from "./client"` (oder `createPrismaClient` dort nutzen).

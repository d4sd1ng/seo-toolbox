# Query-Logging

Prisma 6: **`$extends`**, nicht `$use` (Middleware ist deprecated).

In `src/index.ts` den Client mit `withQueryLogging()` wrappen (siehe `src/index.logging.snippet.ts`).

| Env | Wirkung |
|---|---|
| `PRISMA_SLOW_MS` | Schwellwert, Default `200` |
| `PRISMA_LOG_QUERIES=1` | jede Query (laut, nur lokal) |

Log-Zeile: `{ prisma: true, model, operation, ms }` — **ohne** `args`.

Studio bleibt unberührt; das gilt nur für den App-Client.

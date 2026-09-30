# Prisma-Migrationen

`db push` nur noch lokal zum Spielen. **Produktion und CI: `migrate deploy`.**

| Wann | Befehl |
|---|---|
| Schema geändert | `pnpm db:migrate` (legt SQL unter `prisma/migrations/` an) |
| SQL committen | Git — ohne diese Dateien deployed nichts |
| Container-Start | `prisma migrate deploy` (web-entrypoint) |
| Status | `pnpm --filter db migrate:status` |

Erste Migration, wenn bisher nur `db push` lief:

```bash
sh scripts/prisma-baseline.sh
# bestehende DB:
pnpm --filter db exec prisma migrate resolve --applied <ordnername>
git add packages/db/prisma/migrations
```

CI bricht ab, wenn `schema.prisma` und `migrations/` auseinanderlaufen.

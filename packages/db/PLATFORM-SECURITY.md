# Prisma Data Platform — Sicherheit

Accelerate ist ein **Proxy + Cache**, kein Ersatz für DB-Rechte, RLS oder `ENCRYPTION_KEY`.

## Secrets

| URL | Darf wohin | Darf nicht |
|---|---|---|
| `DATABASE_URL` `prisma://…?api_key=` | Server, GitHub Secret, Container-Env | Git, `NEXT_PUBLIC_*`, Browser, Prisma Studio öffentlich |
| `DIRECT_DATABASE_URL` `postgresql://` | Nur Migrate / Studio / `pg_dump` | App-Runtime wenn Accelerate reicht; nie Client-Bundle |
| `ACCELERATE_URL` | wie `DATABASE_URL` | gleich |

`assertServerDatabaseEnv()` bricht ab bei `NEXT_PUBLIC_DATABASE_URL` und wenn `DIRECT_DATABASE_URL` `prisma://` ist.

## Plattform (Prisma Console)

- API-Key **rotieren**, wenn er in Logs/CI-Output stand
- Projekt auf die **App-IPs** beschränken, falls Console Allowlist anbietet
- Getrennte Keys: Preview vs Production
- Caching: keine Queries mit User-/Session-Daten (`Job`, `Session`, Passwort-Hash) über `readCache`
- Connection-String in Prisma nicht „Public project“

## App

- Session-Cookies `httpOnly`, `secure` in Production (bereits so)
- Tokens in der DB nur als Hash (`Session.tokenHash`)
- GSC/Serper-Keys mit `ENCRYPTION_KEY` (≥ 32, kein `change-me`)
- Worker und Web teilen Secrets nur über Env, nicht übers Image (`COPY .env` vermeiden)

## Migrationen

`prisma migrate deploy` **immer** gegen Postgres (`DIRECT_DATABASE_URL`). Accelerate versteht kein DDL. web-entrypoint setzt das.

## DDoS / Cache

Accelerate-TTL ist kein AuthZ. `readCache` nur für projekt-öffentliche Aggregate (letzter Audit, GSC-Tage), nie für fremde `workspaceId`-Daten ohne vorherigen Session-Check (die Queries bleiben server-seitig mit `getSession`).

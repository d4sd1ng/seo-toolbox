# Schema für Analysen

Diese Indizes matchen die echten Listen: Inbox (`status` + `priorityScore`), Job-Poll, letzte Audits, GSC-Tage, Rank-Verlauf.

SQL liegt in `prisma/migrations/20260830120000_analytics_indexes/`. Anwenden:

```bash
pnpm db:migrate:deploy
# oder lokal, wenn noch db push: die SQL-Datei per psql / Studio Raw
```

Dieselben Indizes in `schema.prisma` eintragen (sonst driftet CI `migrate diff`):

```prisma
model Job {
  @@index([projectId, status, createdAt(sort: Desc)])
  @@index([workspaceId, createdAt(sort: Desc)])
  @@index([type, status])
}

model Issue {
  @@index([projectId, status, priorityScore(sort: Desc)])
  @@index([projectId, sourceModule])
}

model OnPageAudit {
  @@index([projectId, fetchedAt(sort: Desc)])
}

model Crawl {
  @@index([projectId, startedAt(sort: Desc)])
}

model SearchPerformance {
  @@index([projectId, date(sort: Desc)])
}

model Keyword {
  @@index([projectId])
}

model RankResult {
  @@index([projectId, checkedAt(sort: Desc)])
}

model Session {
  @@index([userId, expiresAt])
}

model QuotaBucket {
  @@index([workspaceId, periodStart])
}

model Page {
  @@index([projectId, httpStatus])
}
```

## Studio-Queries

| Frage | Tabelle | Filter |
|---|---|---|
| Offene Arbeit | `Issue` | `status in open,snoozed`, sort `priorityScore` |
| Hängende Jobs | `Job` | `status in queued,running` |
| Score-Verlauf | `OnPageAudit` | Projekt, `fetchedAt` |
| GSC 28 Tage | `SearchPerformance` | `query=""`, `pageUrl=""` |
| Crawl-Umfang | `Crawl` | letztes `startedAt` |

Wenn `RankResult` kein `projectId` hat, die eine Rank-Zeile aus der SQL-Migration streichen.

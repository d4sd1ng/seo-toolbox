-- Query-Pfade: Inbox, Jobs, Audits, GSC, Ranks (Prisma Studio + App)

CREATE INDEX IF NOT EXISTS "Job_projectId_status_createdAt_idx"
  ON "Job" ("projectId", "status", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Job_workspaceId_createdAt_idx"
  ON "Job" ("workspaceId", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Job_type_status_idx"
  ON "Job" ("type", "status");

CREATE INDEX IF NOT EXISTS "Issue_projectId_status_priorityScore_idx"
  ON "Issue" ("projectId", "status", "priorityScore" DESC);

CREATE INDEX IF NOT EXISTS "Issue_projectId_sourceModule_idx"
  ON "Issue" ("projectId", "sourceModule");

CREATE INDEX IF NOT EXISTS "OnPageAudit_projectId_fetchedAt_idx"
  ON "OnPageAudit" ("projectId", "fetchedAt" DESC);

CREATE INDEX IF NOT EXISTS "Crawl_projectId_startedAt_idx"
  ON "Crawl" ("projectId", "startedAt" DESC);

CREATE INDEX IF NOT EXISTS "SearchPerformance_projectId_date_idx"
  ON "SearchPerformance" ("projectId", "date" DESC);

CREATE INDEX IF NOT EXISTS "Keyword_projectId_idx"
  ON "Keyword" ("projectId");

CREATE INDEX IF NOT EXISTS "RankResult_projectId_checkedAt_idx"
  ON "RankResult" ("projectId", "checkedAt" DESC);

CREATE INDEX IF NOT EXISTS "Session_userId_expiresAt_idx"
  ON "Session" ("userId", "expiresAt");

CREATE INDEX IF NOT EXISTS "QuotaBucket_workspaceId_periodStart_idx"
  ON "QuotaBucket" ("workspaceId", "periodStart");

CREATE INDEX IF NOT EXISTS "Page_projectId_httpStatus_idx"
  ON "Page" ("projectId", "httpStatus");

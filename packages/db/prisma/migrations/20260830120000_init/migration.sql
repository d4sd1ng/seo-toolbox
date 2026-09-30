-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('free', 'pro', 'agency');

-- CreateEnum
CREATE TYPE "Device" AS ENUM ('DESKTOP', 'MOBILE', 'TABLET', 'ALL');

-- CreateEnum
CREATE TYPE "SearchEngine" AS ENUM ('GOOGLE', 'BING');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('gsc', 'ga4', 'pagespeed', 'dataforseo', 'serper', 'valueserp');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('connected', 'needs_reauth', 'error');

-- CreateEnum
CREATE TYPE "RankCheckFrequency" AS ENUM ('daily', 'every_3_days', 'weekly');

-- CreateEnum
CREATE TYPE "HttpStatusClass" AS ENUM ('s2xx', 's3xx', 's4xx', 's5xx', 'blocked', 'error');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- CreateEnum
CREATE TYPE "Effort" AS ENUM ('xs', 's', 'm', 'l');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('open', 'snoozed', 'in_progress', 'done', 'ignored');

-- CreateEnum
CREATE TYPE "IssueEntityType" AS ENUM ('page', 'keyword', 'cluster', 'project', 'backlink');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('gsc_sync', 'onpage_audit', 'site_crawl', 'rank_check', 'keyword_expand', 'pagespeed', 'serp_snapshot', 'backlink_sync');

-- CreateEnum
CREATE TYPE "SearchIntent" AS ENUM ('informational', 'commercial', 'transactional', 'navigational', 'unknown');

-- CreateEnum
CREATE TYPE "KeywordSource" AS ENUM ('manual', 'gsc', 'research', 'competitor', 'import');

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'admin', 'member');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" "Plan" NOT NULL DEFAULT 'free',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuotaBucket" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "used" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuotaBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'member',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'connected',
    "accountLabel" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credentialsRef" TEXT NOT NULL,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncAt" TIMESTAMP(3),

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryDomain" TEXT NOT NULL,
    "homepageUrl" TEXT NOT NULL,
    "defaultLocale" TEXT NOT NULL DEFAULT 'de-DE',
    "defaultCountry" TEXT NOT NULL DEFAULT 'DE',
    "defaultDevice" "Device" NOT NULL DEFAULT 'ALL',
    "gscSiteUrl" TEXT,
    "ga4PropertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSettings" (
    "projectId" TEXT NOT NULL,
    "crawlBudgetMaxUrls" INTEGER NOT NULL DEFAULT 500,
    "renderJavascript" BOOLEAN NOT NULL DEFAULT false,
    "respectRobotsTxt" BOOLEAN NOT NULL DEFAULT true,
    "includeSubdomains" BOOLEAN NOT NULL DEFAULT false,
    "rankCheckFrequency" "RankCheckFrequency" NOT NULL DEFAULT 'every_3_days',
    "ignoredIssueTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "ProjectSettings_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "urlNormalized" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "lastCrawledAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "statusClass" "HttpStatusClass",
    "indexable" BOOLEAN,
    "indexabilityReason" TEXT,
    "canonicalUrl" TEXT,
    "canonicalIsSelf" BOOLEAN,
    "robotsDirectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "title" TEXT,
    "metaDescription" TEXT,
    "h1" TEXT,
    "wordCount" INTEGER,
    "internalInLinks" INTEGER NOT NULL DEFAULT 0,
    "internalOutLinks" INTEGER NOT NULL DEFAULT 0,
    "externalOutLinks" INTEGER NOT NULL DEFAULT 0,
    "contentHash" TEXT,
    "schemaTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "Page_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Crawl" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "seedUrl" TEXT NOT NULL,
    "pagesCrawled" INTEGER NOT NULL DEFAULT 0,
    "pagesFailed" INTEGER NOT NULL DEFAULT 0,
    "maxUrls" INTEGER NOT NULL,
    "renderJavascript" BOOLEAN NOT NULL DEFAULT false,
    "metrics" JSONB,

    CONSTRAINT "Crawl_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnPageAudit" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "pageId" TEXT,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metrics" JSONB NOT NULL,

    CONSTRAINT "OnPageAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchPerformance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "query" TEXT NOT NULL DEFAULT '',
    "pageUrl" TEXT NOT NULL DEFAULT '',
    "country" TEXT NOT NULL DEFAULT '',
    "device" "Device" NOT NULL DEFAULT 'ALL',
    "clicks" INTEGER NOT NULL,
    "impressions" INTEGER NOT NULL,
    "ctr" DOUBLE PRECISION NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "SearchPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordCluster" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pillarKeywordId" TEXT,
    "targetUrl" TEXT,
    "notes" TEXT,

    CONSTRAINT "KeywordCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Keyword" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phrase" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'de-DE',
    "country" TEXT NOT NULL DEFAULT 'DE',
    "device" "Device" NOT NULL DEFAULT 'ALL',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "clusterId" TEXT,
    "intent" "SearchIntent" NOT NULL DEFAULT 'unknown',
    "source" "KeywordSource" NOT NULL DEFAULT 'manual',
    "volume" INTEGER,
    "difficulty" INTEGER,
    "cpc" DOUBLE PRECISION,
    "currentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Keyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RankResult" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engine" "SearchEngine" NOT NULL DEFAULT 'GOOGLE',
    "location" TEXT,
    "position" INTEGER,
    "url" TEXT,
    "serpFeatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "previousPosition" INTEGER,

    CONSTRAINT "RankResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Issue" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT NOT NULL,
    "severity" "Severity" NOT NULL,
    "effort" "Effort" NOT NULL,
    "priorityScore" DOUBLE PRECISION NOT NULL,
    "status" "IssueStatus" NOT NULL DEFAULT 'open',
    "entityType" "IssueEntityType" NOT NULL,
    "entityId" TEXT,
    "url" TEXT,
    "sourceModule" TEXT NOT NULL,
    "evidence" JSONB,
    "snoozeUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Issue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "moduleId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'queued',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "resultSummary" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerpSnapshot" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT,
    "query" TEXT NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "engine" "SearchEngine" NOT NULL DEFAULT 'GOOGLE',
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "results" JSONB NOT NULL,

    CONSTRAINT "SerpSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrief" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "keywordId" TEXT NOT NULL,
    "clusterId" TEXT,
    "targetUrl" TEXT,
    "headingOutline" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "entities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "questions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "wordCountTarget" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentBrief_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "QuotaBucket_workspaceId_periodStart_idx" ON "QuotaBucket"("workspaceId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "QuotaBucket_workspaceId_key_periodStart_key" ON "QuotaBucket"("workspaceId", "key", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_workspaceId_provider_key" ON "Integration"("workspaceId", "provider");

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Project_primaryDomain_idx" ON "Project"("primaryDomain");

-- CreateIndex
CREATE INDEX "Page_projectId_statusClass_idx" ON "Page"("projectId", "statusClass");

-- CreateIndex
CREATE INDEX "Page_projectId_indexable_idx" ON "Page"("projectId", "indexable");

-- CreateIndex
CREATE UNIQUE INDEX "Page_projectId_urlNormalized_key" ON "Page"("projectId", "urlNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "Crawl_jobId_key" ON "Crawl"("jobId");

-- CreateIndex
CREATE INDEX "Crawl_projectId_startedAt_idx" ON "Crawl"("projectId", "startedAt");

-- CreateIndex
CREATE INDEX "OnPageAudit_projectId_fetchedAt_idx" ON "OnPageAudit"("projectId", "fetchedAt");

-- CreateIndex
CREATE INDEX "OnPageAudit_url_idx" ON "OnPageAudit"("url");

-- CreateIndex
CREATE INDEX "SearchPerformance_projectId_date_idx" ON "SearchPerformance"("projectId", "date");

-- CreateIndex
CREATE INDEX "SearchPerformance_projectId_query_idx" ON "SearchPerformance"("projectId", "query");

-- CreateIndex
CREATE UNIQUE INDEX "SearchPerformance_projectId_date_query_pageUrl_country_devi_key" ON "SearchPerformance"("projectId", "date", "query", "pageUrl", "country", "device");

-- CreateIndex
CREATE INDEX "KeywordCluster_projectId_idx" ON "KeywordCluster"("projectId");

-- CreateIndex
CREATE INDEX "Keyword_projectId_clusterId_idx" ON "Keyword"("projectId", "clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "Keyword_projectId_phrase_locale_country_device_key" ON "Keyword"("projectId", "phrase", "locale", "country", "device");

-- CreateIndex
CREATE INDEX "RankResult_keywordId_checkedAt_idx" ON "RankResult"("keywordId", "checkedAt");

-- CreateIndex
CREATE INDEX "RankResult_projectId_checkedAt_idx" ON "RankResult"("projectId", "checkedAt");

-- CreateIndex
CREATE INDEX "Issue_projectId_status_priorityScore_idx" ON "Issue"("projectId", "status", "priorityScore");

-- CreateIndex
CREATE INDEX "Issue_projectId_type_idx" ON "Issue"("projectId", "type");

-- CreateIndex
CREATE INDEX "Issue_projectId_sourceModule_idx" ON "Issue"("projectId", "sourceModule");

-- CreateIndex
CREATE INDEX "Job_projectId_status_idx" ON "Job"("projectId", "status");

-- CreateIndex
CREATE INDEX "Job_workspaceId_createdAt_idx" ON "Job"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "SerpSnapshot_projectId_checkedAt_idx" ON "SerpSnapshot"("projectId", "checkedAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuotaBucket" ADD CONSTRAINT "QuotaBucket_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSettings" ADD CONSTRAINT "ProjectSettings_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Page" ADD CONSTRAINT "Page_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crawl" ADD CONSTRAINT "Crawl_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Crawl" ADD CONSTRAINT "Crawl_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnPageAudit" ADD CONSTRAINT "OnPageAudit_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnPageAudit" ADD CONSTRAINT "OnPageAudit_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchPerformance" ADD CONSTRAINT "SearchPerformance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordCluster" ADD CONSTRAINT "KeywordCluster_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Keyword" ADD CONSTRAINT "Keyword_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "KeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankResult" ADD CONSTRAINT "RankResult_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RankResult" ADD CONSTRAINT "RankResult_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Issue" ADD CONSTRAINT "Issue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SerpSnapshot" ADD CONSTRAINT "SerpSnapshot_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_keywordId_fkey" FOREIGN KEY ("keywordId") REFERENCES "Keyword"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentBrief" ADD CONSTRAINT "ContentBrief_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "KeywordCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

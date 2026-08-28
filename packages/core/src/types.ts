/**
 * SEO Toolbox – Core Domain Model
 * Keep this package free of UI and vendor SDKs.
 */

export type ID = string;
export type ISODate = string; // YYYY-MM-DD
export type ISODateTime = string;
export type Locale = `${string}-${string}` | string; // de-DE
export type CountryCode = string; // DE
export type Device = "DESKTOP" | "MOBILE" | "TABLET" | "ALL";
export type SearchEngine = "GOOGLE" | "BING";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Effort = "xs" | "s" | "m" | "l";
export type IssueStatus = "open" | "snoozed" | "in_progress" | "done" | "ignored";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";
export type SearchIntent = "informational" | "commercial" | "transactional" | "navigational" | "unknown";

export interface User {
  id: ID;
  email: string;
  name: string | null;
  createdAt: ISODateTime;
}

export interface Workspace {
  id: ID;
  name: string;
  slug: string;
  plan: "free" | "pro" | "agency";
  createdAt: ISODateTime;
}

export type IntegrationProvider =
  | "gsc"
  | "ga4"
  | "pagespeed"
  | "dataforseo"
  | "serper"
  | "valueserp";

export interface Integration {
  id: ID;
  workspaceId: ID;
  provider: IntegrationProvider;
  status: "connected" | "needs_reauth" | "error";
  accountLabel: string | null;
  scopes: string[];
  /** Encrypted at rest. Never send to the client. */
  credentialsRef: string;
  connectedAt: ISODateTime;
  lastSyncAt: ISODateTime | null;
}

export interface Project {
  id: ID;
  workspaceId: ID;
  name: string;
  primaryDomain: string; // example.de
  homepageUrl: string; // https://www.example.de
  defaultLocale: Locale;
  defaultCountry: CountryCode;
  defaultDevice: Device;
  gscSiteUrl: string | null; // sc-domain:example.de or https://www.example.de/
  ga4PropertyId: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface ProjectSettings {
  projectId: ID;
  crawlBudgetMaxUrls: number;
  renderJavascript: boolean;
  respectRobotsTxt: boolean;
  includeSubdomains: boolean;
  rankCheckFrequency: "daily" | "every_3_days" | "weekly";
  ignoredIssueTypes: string[];
}

/* ------------------------------------------------------------------ */
/*  Crawl / Page                                                       */
/* ------------------------------------------------------------------ */

export type HttpStatusClass = "2xx" | "3xx" | "4xx" | "5xx" | "blocked" | "error";

export interface Page {
  id: ID;
  projectId: ID;
  url: string;
  urlNormalized: string;
  path: string;
  lastCrawledAt: ISODateTime | null;
  httpStatus: number | null;
  statusClass: HttpStatusClass | null;
  indexable: boolean | null;
  indexabilityReason: string | null;
  canonicalUrl: string | null;
  canonicalIsSelf: boolean | null;
  robotsDirectives: string[];
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number | null;
  internalInLinks: number;
  internalOutLinks: number;
  externalOutLinks: number;
  contentHash: string | null;
  schemaTypes: string[];
}

export interface Crawl {
  id: ID;
  projectId: ID;
  jobId: ID;
  startedAt: ISODateTime;
  finishedAt: ISODateTime | null;
  seedUrl: string;
  pagesCrawled: number;
  pagesFailed: number;
  maxUrls: number;
  renderJavascript: boolean;
}

export interface OnPageAudit {
  id: ID;
  projectId: ID;
  pageId: ID | null;
  url: string;
  score: number; // 0-100
  fetchedAt: ISODateTime;
  metrics: {
    titleLength: number | null;
    metaLength: number | null;
    h1Count: number;
    headingOutline: string[];
    images: number;
    imagesMissingAlt: number;
    wordCount: number;
    hasViewport: boolean;
    isHttps: boolean;
    htmlSizeBytes: number | null;
  };
}

/* ------------------------------------------------------------------ */
/*  Search performance (GSC)                                           */
/* ------------------------------------------------------------------ */

export interface SearchQuery {
  id: ID;
  projectId: ID;
  query: string;
  localeHint: Locale | null;
}

export interface SearchPagePerformance {
  projectId: ID;
  date: ISODate;
  query: string | null;
  pageUrl: string | null;
  country: CountryCode | null;
  device: Device | null;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface PerformanceSnapshot {
  projectId: ID;
  range: { from: ISODate; to: ISODate };
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  deltaClicks: number;
  deltaImpressions: number;
}

/* ------------------------------------------------------------------ */
/*  Keywords & Rankings                                                */
/* ------------------------------------------------------------------ */

export type KeywordSource = "manual" | "gsc" | "research" | "competitor" | "import";

export interface Keyword {
  id: ID;
  projectId: ID;
  phrase: string;
  locale: Locale;
  country: CountryCode;
  device: Device;
  tags: string[];
  clusterId: ID | null;
  intent: SearchIntent;
  source: KeywordSource;
  volume: number | null;
  difficulty: number | null; // 0-100
  cpc: number | null;
  currentUrl: string | null; // intended landing page
  createdAt: ISODateTime;
}

export interface KeywordCluster {
  id: ID;
  projectId: ID;
  name: string;
  pillarKeywordId: ID | null;
  targetUrl: string | null;
  notes: string | null;
}

export interface RankResult {
  id: ID;
  projectId: ID;
  keywordId: ID;
  checkedAt: ISODateTime;
  engine: SearchEngine;
  location: string | null;
  position: number | null; // null = not in tracked depth
  url: string | null;
  serpFeatures: string[]; // ai_overview, featured_snippet, local_pack, video, paa
  previousPosition: number | null;
}

/* ------------------------------------------------------------------ */
/*  Issues – central work queue                                        */
/* ------------------------------------------------------------------ */

export type IssueEntityType = "page" | "keyword" | "cluster" | "project" | "backlink";

export interface Issue {
  id: ID;
  projectId: ID;
  type: string; // e.g. "missing_title", "ctr_opportunity", "4xx"
  title: string;
  description: string;
  recommendation: string;
  severity: Severity;
  effort: Effort;
  /** impact * confidence, used for ranking the inbox */
  priorityScore: number;
  status: IssueStatus;
  entityType: IssueEntityType;
  entityId: ID | null;
  url: string | null;
  sourceModule: string; // plugin id
  evidence: Record<string, unknown>;
  snoozeUntil: ISODateTime | null;
  createdAt: ISODateTime;
  resolvedAt: ISODateTime | null;
}

/* ------------------------------------------------------------------ */
/*  Jobs                                                               */
/* ------------------------------------------------------------------ */

export type JobType =
  | "gsc_sync"
  | "onpage_audit"
  | "site_crawl"
  | "rank_check"
  | "keyword_expand"
  | "pagespeed"
  | "serp_snapshot"
  | "backlink_sync";

export interface Job {
  id: ID;
  workspaceId: ID;
  projectId: ID;
  type: JobType;
  moduleId: string;
  status: JobStatus;
  progress: number; // 0-100
  payload: Record<string, unknown>;
  resultSummary: string | null;
  error: string | null;
  createdAt: ISODateTime;
  startedAt: ISODateTime | null;
  finishedAt: ISODateTime | null;
}

/* ------------------------------------------------------------------ */
/*  Content brief / SERP snapshot                                      */
/* ------------------------------------------------------------------ */

export interface SerpSnapshot {
  id: ID;
  projectId: ID;
  keywordId: ID | null;
  query: string;
  checkedAt: ISODateTime;
  engine: SearchEngine;
  features: string[];
  results: Array<{
    position: number;
    url: string;
    domain: string;
    title: string;
    type: "organic" | "ai_overview" | "snippet" | "local" | "video";
  }>;
}

export interface ContentBrief {
  id: ID;
  projectId: ID;
  keywordId: ID;
  clusterId: ID | null;
  targetUrl: string | null;
  headingOutline: string[];
  entities: string[];
  questions: string[];
  wordCountTarget: number | null;
  notes: string | null;
  createdAt: ISODateTime;
}

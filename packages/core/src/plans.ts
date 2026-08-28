export type PlanId = "free" | "pro" | "agency";

export type PlanCaps = {
  projects: number;
  members: number;
  crawlMaxUrls: number;
  renderSlots: number;
  rankKeywordsPerRun: number;
  rankRunsPerDay: number;
  keywordIdeas: number;
  pagespeedPerDay: number;
  researchPerDay: number;
  backlinkSyncsPerDay: number;
  crawlsPerDay: number;
  onpagePerDay: number;
  gscSyncsPerDay: number;
  keywordsTracked: number;
  concurrentJobs: number;
};

export const PLAN_CAPS: Record<PlanId, PlanCaps> = {
  free: {
    projects: 2,
    members: 2,
    crawlMaxUrls: 200,
    renderSlots: 20,
    rankKeywordsPerRun: 10,
    rankRunsPerDay: 1,
    keywordIdeas: 15,
    pagespeedPerDay: 5,
    researchPerDay: 5,
    backlinkSyncsPerDay: 1,
    crawlsPerDay: 3,
    onpagePerDay: 20,
    gscSyncsPerDay: 4,
    keywordsTracked: 50,
    concurrentJobs: 1,
  },
  pro: {
    projects: 20,
    members: 10,
    crawlMaxUrls: 1000,
    renderSlots: 80,
    rankKeywordsPerRun: 50,
    rankRunsPerDay: 5,
    keywordIdeas: 50,
    pagespeedPerDay: 40,
    researchPerDay: 30,
    backlinkSyncsPerDay: 10,
    crawlsPerDay: 20,
    onpagePerDay: 200,
    gscSyncsPerDay: 24,
    keywordsTracked: 2000,
    concurrentJobs: 3,
  },
  agency: {
    projects: 200,
    members: 50,
    crawlMaxUrls: 2000,
    renderSlots: 150,
    rankKeywordsPerRun: 150,
    rankRunsPerDay: 20,
    keywordIdeas: 100,
    pagespeedPerDay: 200,
    researchPerDay: 100,
    backlinkSyncsPerDay: 50,
    crawlsPerDay: 80,
    onpagePerDay: 1000,
    gscSyncsPerDay: 48,
    keywordsTracked: 20000,
    concurrentJobs: 8,
  },
};

export class LimitError extends Error {
  readonly code = "PLAN_LIMIT";
  constructor(
    message: string,
    readonly remaining = 0,
  ) {
    super(message);
    this.name = "LimitError";
  }
}

export function dailyCapForJob(type: string, caps: PlanCaps): number | null {
  switch (type) {
    case "rank_check":
      return caps.rankRunsPerDay;
    case "pagespeed":
      return caps.pagespeedPerDay;
    case "keyword_expand":
      return caps.researchPerDay;
    case "backlink_sync":
      return caps.backlinkSyncsPerDay;
    case "site_crawl":
      return caps.crawlsPerDay;
    case "onpage_audit":
      return caps.onpagePerDay;
    case "gsc_sync":
      return caps.gscSyncsPerDay;
    case "serp_snapshot":
      return caps.researchPerDay;
    default:
      return null;
  }
}

export function quotaKeyForJob(type: string): string | null {
  switch (type) {
    case "rank_check":
      return "rankRunsPerDay";
    case "pagespeed":
      return "pagespeedPerDay";
    case "keyword_expand":
    case "serp_snapshot":
      return "researchPerDay";
    case "backlink_sync":
      return "backlinkSyncsPerDay";
    case "site_crawl":
      return "crawlsPerDay";
    case "onpage_audit":
      return "onpagePerDay";
    case "gsc_sync":
      return "gscSyncsPerDay";
    default:
      return null;
  }
}

export function planCaps(plan: string | null | undefined): PlanCaps {
  if (plan === "pro" || plan === "agency") return PLAN_CAPS[plan];
  return PLAN_CAPS.free;
}

export function clampToCap(requested: number | undefined, cap: number, fallback = cap) {
  const value = requested ?? fallback;
  return Math.min(cap, Math.max(1, value));
}

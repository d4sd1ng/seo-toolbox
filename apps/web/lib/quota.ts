import { NextResponse } from "next/server";
import { workspaceUsage, type QuotaRow } from "db";

const JOB_QUOTA: Record<string, string> = {
  site_crawl: "crawlsPerDay",
  onpage_audit: "onpagePerDay",
  gsc_sync: "gscSyncsPerDay",
  rank_check: "rankRunsPerDay",
  pagespeed: "pagespeedPerDay",
  keyword_expand: "researchPerDay",
  backlink_sync: "backlinkSyncsPerDay",
  serp_snapshot: "researchPerDay",
};

function resetUnix() {
  const end = new Date();
  end.setHours(24, 0, 0, 0);
  return Math.floor(end.getTime() / 1000);
}

export async function buildQuotaHeaders(workspaceId: string, jobType?: string) {
  const usage = await workspaceUsage(workspaceId);
  const key = jobType ? JOB_QUOTA[jobType] : "concurrentJobs";
  const row =
    usage.quotas.find((q) => q.key === key) ??
    usage.quotas.find((q) => q.key === "concurrentJobs")!;
  const concurrent = usage.quotas.find((q) => q.key === "concurrentJobs");
  return {
    usage,
    row,
    headers: {
      "RateLimit-Limit": String(row.limit),
      "RateLimit-Remaining": String(row.remaining),
      "RateLimit-Reset": String(resetUnix()),
      "X-Quota-Plan": usage.plan,
      "X-Quota-Policy": row.key,
      "X-Quota-Used": String(row.used),
      "X-Quota-Concurrent-Remaining": String(concurrent?.remaining ?? 0),
    } as Record<string, string>,
  };
}

export async function jsonWithQuota(
  workspaceId: string,
  body: unknown,
  init?: { status?: number; jobType?: string },
) {
  const { headers } = await buildQuotaHeaders(workspaceId, init?.jobType);
  return NextResponse.json(body, { status: init?.status ?? 200, headers });
}

export function pickHeaderQuotas(quotas: QuotaRow[]) {
  const keys = ["concurrentJobs", "crawlsPerDay", "rankRunsPerDay", "onpagePerDay", "keywordsTracked"];
  return quotas.filter((q) => keys.includes(q.key));
}

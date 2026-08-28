import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";

import { dailyCapForJob, LimitError, planCaps, quotaKeyForJob, type PlanCaps } from "core";

export async function workspacePlanCaps(workspaceId: string): Promise<PlanCaps & { plan: string }> {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  const plan = workspace?.plan ?? "free";
  return { plan, ...planCaps(plan) };
}

function startOfDay() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start;
}

export async function jobsToday(workspaceId: string, type: string) {
  const key = quotaKeyForJob(type);
  if (key) {
    const bucket = await prisma.quotaBucket.findUnique({
      where: {
        workspaceId_key_periodStart: {
          workspaceId,
          key,
          periodStart: startOfDay(),
        },
      },
    });
    if (bucket) return bucket.used;
  }
  return prisma.job.count({
    where: {
      workspaceId,
      type: type as never,
      createdAt: { gte: startOfDay() },
      status: { not: "canceled" },
    },
  });
}

export async function incrementQuota(workspaceId: string, type: string, by = 1) {
  const key = quotaKeyForJob(type);
  if (!key) return null;
  const periodStart = startOfDay();
  return prisma.quotaBucket.upsert({
    where: { workspaceId_key_periodStart: { workspaceId, key, periodStart } },
    create: { workspaceId, key, periodStart, used: by },
    update: { used: { increment: by } },
  });
}

export async function readDailyBuckets(workspaceId: string) {
  const periodStart = startOfDay();
  const rows = await prisma.quotaBucket.findMany({
    where: { workspaceId, periodStart },
  });
  return Object.fromEntries(rows.map((r) => [r.key, r.used])) as Record<string, number>;
}

export type QuotaRow = { key: string; used: number; limit: number; remaining: number };

export async function workspaceUsage(workspaceId: string) {
  const caps = await workspacePlanCaps(workspaceId);
  const [projects, members, keywords, concurrent, daily] = await Promise.all([
    prisma.project.count({ where: { workspaceId } }),
    prisma.membership.count({ where: { workspaceId } }),
    prisma.keyword.count({ where: { project: { workspaceId } } }),
    prisma.job.count({
      where: { workspaceId, status: { in: ["queued", "running"] } },
    }),
    readDailyBuckets(workspaceId),
  ]);

  const row = (key: string, used: number, limit: number): QuotaRow => ({
    key,
    used,
    limit,
    remaining: Math.max(0, limit - used),
  });

  return {
    plan: caps.plan,
    caps,
    quotas: [
      row("projects", projects, caps.projects),
      row("members", members, caps.members),
      row("keywordsTracked", keywords, caps.keywordsTracked),
      row("concurrentJobs", concurrent, caps.concurrentJobs),
      row("crawlsPerDay", daily.crawlsPerDay ?? 0, caps.crawlsPerDay),
      row("onpagePerDay", daily.onpagePerDay ?? 0, caps.onpagePerDay),
      row("gscSyncsPerDay", daily.gscSyncsPerDay ?? 0, caps.gscSyncsPerDay),
      row("rankRunsPerDay", daily.rankRunsPerDay ?? 0, caps.rankRunsPerDay),
      row("pagespeedPerDay", daily.pagespeedPerDay ?? 0, caps.pagespeedPerDay),
      row("researchPerDay", daily.researchPerDay ?? 0, caps.researchPerDay),
      row("backlinkSyncsPerDay", daily.backlinkSyncsPerDay ?? 0, caps.backlinkSyncsPerDay),
    ],
  };
}

export async function assertJobLimits(workspaceId: string, type: string) {
  const caps = await workspacePlanCaps(workspaceId);
  const running = await prisma.job.count({
    where: { workspaceId, status: { in: ["queued", "running"] } },
  });
  if (running >= caps.concurrentJobs) {
    throw new LimitError(
      `Zu viele parallele Jobs auf Plan ${caps.plan} (${caps.concurrentJobs}).`,
      0,
    );
  }
  const daily = dailyCapForJob(type, caps);
  if (daily != null) {
    const used = await jobsToday(workspaceId, type);
    if (used >= daily) {
      throw new LimitError(`Tageslimit für ${type} auf Plan ${caps.plan} erreicht (${daily}/Tag).`, 0);
    }
  }
  return caps;
}

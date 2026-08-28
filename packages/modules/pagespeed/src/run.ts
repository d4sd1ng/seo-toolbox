import { priorityScore } from "core";
import { prisma } from "db";

type PsiResponse = {
  lighthouseResult?: { categories?: { performance?: { score?: number } } };
  loadingExperience?: {
    metrics?: Record<string, { percentile?: number; category?: string }>;
  };
  error?: { message: string };
};

export async function runPageSpeed(input: {
  projectId: string;
  workspaceId: string;
  jobId: string;
  url?: string;
  strategy?: "mobile" | "desktop";
}) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  const url = input.url ?? project.homepageUrl;
  const strategy = input.strategy ?? "mobile";

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "running", startedAt: new Date(), progress: 20 },
  });

  const endpoint = new URL("https://www.googleapis.com/pagespeedonline/v5/runPagespeed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("category", "PERFORMANCE");
  if (process.env.PAGESPEED_API_KEY) {
    endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  }

  const res = await fetch(endpoint);
  const json = (await res.json()) as PsiResponse;
  if (!res.ok) {
    throw new Error(json.error?.message ?? `PageSpeed HTTP ${res.status}`);
  }

  const perf = Math.round((json.lighthouseResult?.categories?.performance?.score ?? 0) * 100);
  const metrics = json.loadingExperience?.metrics ?? {};
  const lcp = metrics.LARGEST_CONTENTFUL_PAINT_MS?.percentile;
  const inp = metrics.INTERACTION_TO_NEXT_PAINT?.percentile ?? metrics.FIRST_INPUT_DELAY_MS?.percentile;
  const cls = metrics.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile;

  await writeVitalIssue({
    projectId: project.id,
    url,
    type: "poor_lcp",
    title: `LCP ${lcp ?? "?"} ms`,
    bad: typeof lcp === "number" && lcp > 2500,
    recommendation: "Größtes Element beschleunigen: Bild komprimieren, Server/TTFB, Hero nicht blockieren.",
    evidence: { lcp, strategy, perf },
  });
  await writeVitalIssue({
    projectId: project.id,
    url,
    type: "poor_inp",
    title: `INP/FID ${inp ?? "?"} ms`,
    bad: typeof inp === "number" && inp > 200,
    recommendation: "Long Tasks und schwere Click-Handler reduzieren.",
    evidence: { inp, strategy, perf },
  });
  await writeVitalIssue({
    projectId: project.id,
    url,
    type: "poor_cls",
    title: `CLS ${cls ?? "?"}`,
    bad: typeof cls === "number" && cls > 10,
    recommendation: "Bilder/Ads mit Breite/Höhe reservieren, Fonts ohne Layoutsprung laden.",
    evidence: { cls, strategy, perf },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      resultSummary: `Score ${perf} · LCP ${lcp ?? "–"} · ${strategy}`,
    },
  });

  return { perf, lcp, inp, cls, strategy, url };
}

async function writeVitalIssue(input: {
  projectId: string;
  url: string;
  type: string;
  title: string;
  bad: boolean;
  recommendation: string;
  evidence: Record<string, unknown>;
}) {
  const existing = await prisma.issue.findFirst({
    where: {
      projectId: input.projectId,
      type: input.type,
      url: input.url,
      sourceModule: "pagespeed",
      status: { in: ["open", "snoozed", "in_progress"] },
    },
  });
  if (!input.bad) {
    if (existing) {
      await prisma.issue.update({
        where: { id: existing.id },
        data: { status: "done", resolvedAt: new Date() },
      });
    }
    return;
  }
  const fields = {
    title: input.title,
    description: input.title,
    recommendation: input.recommendation,
    severity: "high" as const,
    effort: "m" as const,
    priorityScore: priorityScore({
      severity: "high",
      effort: "m",
      impact: 0.7,
      confidence: 0.75,
    }),
    evidence: input.evidence,
  };
  if (existing) {
    await prisma.issue.update({ where: { id: existing.id }, data: fields });
    return;
  }
  await prisma.issue.create({
    data: {
      ...fields,
      projectId: input.projectId,
      type: input.type,
      url: input.url,
      status: "open",
      entityType: "page",
      sourceModule: "pagespeed",
    },
  });
}

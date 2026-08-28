import { hostnameOf, normalizeUrl } from "core";
import { prisma } from "db";
import { renderUrl, shouldRender } from "module-crawler";
import { analyzeHtml } from "./analyze";

const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "SEOToolboxBot/0.1 (+https://localhost)";

export async function runOnPageAudit(input: {
  projectId: string;
  workspaceId: string;
  url: string;
  jobId?: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
  });

  const target = normalizeUrl(input.url);
  if (hostnameOf(target) !== hostnameOf(project.homepageUrl) &&
      hostnameOf(target) !== project.primaryDomain) {
    throw new Error("URL liegt außerhalb der Projekt-Domain.");
  }

  if (input.jobId) {
    await prisma.job.update({
      where: { id: input.jobId },
      data: { status: "running", startedAt: new Date(), progress: 10 },
    });
  }

  const fetched = await fetchHtml(target);
  let html = fetched.html;
  let rendered = false;
  const rawAnalysis = analyzeHtml({
    url: target,
    html: fetched.html,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
  });
  const heuristic = shouldRender({
    status: fetched.status,
    html: fetched.html,
    contentType: "text/html",
    isSeed: false,
  });
  if (heuristic.render) {
    const painted = await renderUrl(fetched.finalUrl || target);
    if (!painted.error && painted.html) {
      html = painted.html;
      rendered = true;
    }
  }
  const analysis = analyzeHtml({
    url: target,
    html,
    finalUrl: fetched.finalUrl,
    status: fetched.status,
  });
  analysis.metrics = {
    ...analysis.metrics,
    rawScore: rawAnalysis.score,
    rendered,
  } as typeof analysis.metrics;

  const page = await prisma.page.upsert({
    where: {
      projectId_urlNormalized: {
        projectId: project.id,
        urlNormalized: normalizeUrl(fetched.finalUrl),
      },
    },
    create: {
      projectId: project.id,
      url: fetched.finalUrl,
      urlNormalized: normalizeUrl(fetched.finalUrl),
      path: new URL(fetched.finalUrl).pathname,
      lastCrawledAt: new Date(),
      httpStatus: fetched.status,
      statusClass: statusClass(fetched.status),
      indexable: analysis.indexable,
      indexabilityReason: analysis.indexabilityReason,
      canonicalUrl: analysis.metrics.canonicalUrl,
      canonicalIsSelf:
        Boolean(analysis.metrics.canonicalUrl) &&
        strip(analysis.metrics.canonicalUrl!) === strip(fetched.finalUrl),
      robotsDirectives: analysis.metrics.robots,
      title: analysis.metrics.title,
      metaDescription: analysis.metrics.metaDescription,
      h1: analysis.metrics.h1,
      wordCount: analysis.metrics.wordCount,
      schemaTypes: analysis.metrics.schemaTypes,
    },
    update: {
      lastCrawledAt: new Date(),
      httpStatus: fetched.status,
      statusClass: statusClass(fetched.status),
      indexable: analysis.indexable,
      indexabilityReason: analysis.indexabilityReason,
      canonicalUrl: analysis.metrics.canonicalUrl,
      title: analysis.metrics.title,
      metaDescription: analysis.metrics.metaDescription,
      h1: analysis.metrics.h1,
      wordCount: analysis.metrics.wordCount,
      schemaTypes: analysis.metrics.schemaTypes,
    },
  });

  const audit = await prisma.onPageAudit.create({
    data: {
      projectId: project.id,
      pageId: page.id,
      url: fetched.finalUrl,
      score: analysis.score,
      metrics: analysis.metrics as object,
    },
  });

  await upsertFindings({
    projectId: project.id,
    pageId: page.id,
    url: fetched.finalUrl,
    findings: analysis.findings,
  });

  if (input.jobId) {
    await prisma.job.update({
      where: { id: input.jobId },
      data: {
        status: "succeeded",
        progress: 100,
        finishedAt: new Date(),
        resultSummary: `Score ${analysis.score}, ${analysis.findings.length} Findings`,
      },
    });
  }

  return { auditId: audit.id, pageId: page.id, analysis };
}

async function upsertFindings(input: {
  projectId: string;
  pageId: string;
  url: string;
  findings: ReturnType<typeof analyzeHtml>["findings"];
}) {
  for (const finding of input.findings) {
    const existing = await prisma.issue.findFirst({
      where: {
        projectId: input.projectId,
        type: finding.type,
        url: input.url,
        status: { in: ["open", "snoozed", "in_progress"] },
      },
    });
    if (existing) {
      await prisma.issue.update({
        where: { id: existing.id },
        data: {
          title: finding.title,
          description: finding.description,
          recommendation: finding.recommendation,
          severity: finding.severity,
          effort: finding.effort,
          priorityScore: finding.priorityScore,
          evidence: finding.evidence,
        },
      });
      continue;
    }
    await prisma.issue.create({
      data: {
        projectId: input.projectId,
        type: finding.type,
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation,
        severity: finding.severity,
        effort: finding.effort,
        priorityScore: finding.priorityScore,
        status: "open",
        entityType: "page",
        entityId: input.pageId,
        url: input.url,
        sourceModule: "onpage",
        evidence: finding.evidence,
      },
    });
  }
}

async function fetchHtml(url: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
    });
    const html = await res.text();
    return { status: res.status, finalUrl: res.url || url, html };
  } finally {
    clearTimeout(timer);
  }
}

function statusClass(status: number) {
  if (status >= 200 && status < 300) return "s2xx" as const;
  if (status >= 300 && status < 400) return "s3xx" as const;
  if (status >= 400 && status < 500) return "s4xx" as const;
  if (status >= 500) return "s5xx" as const;
  return "error" as const;
}

function strip(url: string) {
  return url.replace(/\/$/, "");
}

import { priorityScore, type Effort, type Severity } from "core";
import { prisma } from "db";
import type { CrawledRecord } from "./run-crawl";

export async function writeCrawlIssues(projectId: string, records: CrawledRecord[]) {
  const htmlOk = records.filter((r) => r.status >= 200 && r.status < 300 && r.fromHtml);

  await syncAggregate({
    projectId,
    type: "status_4xx",
    title: `${count(records, (r) => r.status >= 400 && r.status < 500)} URLs mit 4xx`,
    urls: records.filter((r) => r.status >= 400 && r.status < 500).map((r) => r.url),
    recommendation: "Tote Links und interne Verweise auf 404/410 bereinigen oder umleiten.",
    severity: "high",
    effort: "s",
    impact: 0.7,
  });

  await syncAggregate({
    projectId,
    type: "status_5xx",
    title: `${count(records, (r) => r.status >= 500)} URLs mit 5xx`,
    urls: records.filter((r) => r.status >= 500).map((r) => r.url),
    recommendation: "Serverfehler priorisiert beheben – die Seiten fallen aus dem Index.",
    severity: "critical",
    effort: "m",
    impact: 0.95,
  });

  await syncAggregate({
    projectId,
    type: "redirect_chain",
    title: `${count(records, (r) => r.chainLength > 1)} Redirect-Ketten`,
    urls: records.filter((r) => r.chainLength > 1).map((r) => r.url),
    recommendation: "Auf ein einziges Ziel umleiten, Zwischen-Hops streichen.",
    severity: "medium",
    effort: "s",
    impact: 0.4,
  });

  await syncAggregate({
    projectId,
    type: "missing_title",
    title: `${count(htmlOk, (r) => !r.title)} Seiten ohne Title`,
    urls: htmlOk.filter((r) => !r.title).map((r) => r.url),
    recommendation: "Eindeutigen Title pro URL setzen.",
    severity: "high",
    effort: "s",
    impact: 0.75,
  });

  await syncAggregate({
    projectId,
    type: "missing_h1",
    title: `${count(htmlOk, (r) => !r.h1)} Seiten ohne H1`,
    urls: htmlOk.filter((r) => !r.h1).map((r) => r.url),
    recommendation: "Eine H1 setzen, die zum Title und zur Suchintention passt.",
    severity: "medium",
    effort: "s",
    impact: 0.45,
  });

  await syncAggregate({
    projectId,
    type: "canonical_mismatch",
    title: `${count(htmlOk, (r) => r.canonicalUrl && !r.canonicalIsSelf)} Canonicals zeigen weg`,
    urls: htmlOk.filter((r) => r.canonicalUrl && !r.canonicalIsSelf).map((r) => r.url),
    recommendation: "Prüfen, ob das Absicht ist. Sonst Self-Canonical setzen.",
    severity: "high",
    effort: "s",
    impact: 0.6,
  });

  await syncAggregate({
    projectId,
    type: "js_dependent_content",
    title: `${count(records, (r) => Boolean(r.rendered && (r.rawWordCount ?? 0) < 80 && (r.renderedWordCount ?? 0) > 120))} URLs mit JS-abhängigem Inhalt`,
    urls: records
      .filter((r) => Boolean(r.rendered && (r.rawWordCount ?? 0) < 80 && (r.renderedWordCount ?? 0) > 120))
      .map((r) => r.url),
    recommendation: "Wichtigen Inhalt server-seitig ausliefern. Google rendert, aber nicht zuverlässig wie ein volles Chrome.",
    severity: "medium",
    effort: "l",
    impact: 0.55,
  });

  await syncAggregate({
    projectId,
    type: "orphan_pages",
    title: `${count(htmlOk, (r) => r.internalInLinks === 0 && !r.isSeed)} verwaiste Seiten`,
    urls: htmlOk.filter((r) => r.internalInLinks === 0 && !r.isSeed).map((r) => r.url),
    recommendation: "Interne Links setzen oder Seite aus Sitemap/Crawl-Pfaden nehmen.",
    severity: "medium",
    effort: "m",
    impact: 0.4,
  });

  const titleGroups = new Map<string, string[]>();
  for (const row of htmlOk) {
    if (!row.title) continue;
    const key = row.title.trim().toLowerCase();
    const list = titleGroups.get(key) ?? [];
    list.push(row.url);
    titleGroups.set(key, list);
  }
  const duplicates = [...titleGroups.entries()].filter(([, urls]) => urls.length > 1).slice(0, 25);
  await closeStaleDuplicates(projectId, duplicates.map(([title]) => title));
  for (const [title, urls] of duplicates) {
    await upsertTyped({
      projectId,
      type: "duplicate_title",
      title: `Doppelter Title: „${title.slice(0, 80)}“`,
      description: `${urls.length} URLs teilen sich denselben Title.`,
      recommendation: "Titles eindeutig machen, sonst konkurrieren die URLs.",
      severity: "medium",
      effort: "s",
      priorityScore: priorityScore({
        severity: "medium",
        effort: "s",
        impact: Math.min(1, urls.length / 8),
        confidence: 0.85,
      }),
      url: urls[0],
      evidence: { title, urls: urls.slice(0, 40) },
    });
  }
}

function count<T>(items: T[], pred: (item: T) => boolean) {
  return items.filter(pred).length;
}

async function syncAggregate(input: {
  projectId: string;
  type: string;
  title: string;
  urls: string[];
  recommendation: string;
  severity: Severity;
  effort: Effort;
  impact: number;
}) {
  if (input.urls.length === 0) {
    await prisma.issue.updateMany({
      where: {
        projectId: input.projectId,
        sourceModule: "crawler",
        type: input.type,
        status: { in: ["open", "snoozed", "in_progress"] },
      },
      data: { status: "done", resolvedAt: new Date() },
    });
    return;
  }

  await upsertTyped({
    projectId: input.projectId,
    type: input.type,
    title: input.title,
    description: `${input.urls.length} betroffene URLs.`,
    recommendation: input.recommendation,
    severity: input.severity,
    effort: input.effort,
    priorityScore: priorityScore({
      severity: input.severity,
      effort: input.effort,
      impact: Math.min(1, input.impact + input.urls.length / 80),
      confidence: 0.8,
    }),
    url: input.urls[0],
    evidence: { urls: input.urls.slice(0, 50), count: input.urls.length },
  });
}

async function closeStaleDuplicates(projectId: string, activeTitles: string[]) {
  const open = await prisma.issue.findMany({
    where: {
      projectId,
      sourceModule: "crawler",
      type: "duplicate_title",
      status: { in: ["open", "snoozed"] },
    },
  });
  for (const issue of open) {
    const still = activeTitles.some((t) => issue.title.toLowerCase().includes(t.slice(0, 40)));
    if (!still) {
      await prisma.issue.update({
        where: { id: issue.id },
        data: { status: "done", resolvedAt: new Date() },
      });
    }
  }
}

async function upsertTyped(data: {
  projectId: string;
  type: string;
  title: string;
  description: string;
  recommendation: string;
  severity: Severity;
  effort: Effort;
  priorityScore: number;
  url: string;
  evidence: Record<string, unknown>;
}) {
  const existing = await prisma.issue.findFirst({
    where: {
      projectId: data.projectId,
      sourceModule: "crawler",
      type: data.type,
      title: data.title,
      status: { in: ["open", "snoozed", "in_progress"] },
    },
  });
  const fields = {
    description: data.description,
    recommendation: data.recommendation,
    severity: data.severity,
    effort: data.effort,
    priorityScore: data.priorityScore,
    evidence: data.evidence,
    url: data.url,
    entityType: "project" as const,
  };
  if (existing) {
    await prisma.issue.update({ where: { id: existing.id }, data: fields });
    return;
  }
  await prisma.issue.create({
    data: {
      ...fields,
      projectId: data.projectId,
      type: data.type,
      title: data.title,
      sourceModule: "crawler",
      status: "open",
    },
  });
}

import { priorityScore } from "core";
import { prisma } from "db";

type QueryPageRow = {
  query: string;
  pageUrl: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export async function writeGscIssues(projectId: string, rows: QueryPageRow[]) {
  const opportunities = rows.filter(
    (row) =>
      row.impressions >= 80 &&
      row.position >= 3 &&
      row.position <= 15 &&
      row.ctr < expectedCtr(row.position) * 0.7,
  );

  const weakPosition = rows.filter(
    (row) => row.impressions >= 200 && row.position > 10 && row.position <= 30,
  );

  for (const row of opportunities.slice(0, 40)) {
    await upsertIssue({
      projectId,
      type: "ctr_opportunity",
      title: `CTR-Chance: „${row.query}“`,
      description: `${row.impressions} Impressions, CTR ${(row.ctr * 100).toFixed(1)} %, Position ${row.position.toFixed(1)}.`,
      recommendation: "Title und Meta Description schärfen – hohe Sichtbarkeit, zu wenige Klicks.",
      severity: "high",
      effort: "s",
      priorityScore: priorityScore({
        severity: "high",
        effort: "s",
        impact: Math.min(1, row.impressions / 2000),
        confidence: 0.9,
      }),
      url: row.pageUrl,
      evidence: row,
    });
  }

  for (const row of weakPosition.slice(0, 25)) {
    await upsertIssue({
      projectId,
      type: "high_impressions_poor_position",
      title: `Ausbauen: „${row.query}“`,
      description: `${row.impressions} Impressions auf Position ${row.position.toFixed(1)}.`,
      recommendation: "Inhalt und interne Links der Zielseite stärken, Snippet und Intent prüfen.",
      severity: "medium",
      effort: "m",
      priorityScore: priorityScore({
        severity: "medium",
        effort: "m",
        impact: Math.min(1, row.impressions / 3000),
        confidence: 0.8,
      }),
      url: row.pageUrl,
      evidence: row,
    });
  }
}

function expectedCtr(position: number) {
  if (position <= 1.5) return 0.28;
  if (position <= 3) return 0.15;
  if (position <= 5) return 0.08;
  if (position <= 10) return 0.03;
  return 0.015;
}

async function upsertIssue(data: {
  projectId: string;
  type: string;
  title: string;
  description: string;
  recommendation: string;
  severity: "high" | "medium";
  effort: "s" | "m";
  priorityScore: number;
  url: string;
  evidence: Record<string, unknown>;
}) {
  const existing = await prisma.issue.findFirst({
    where: {
      projectId: data.projectId,
      type: data.type,
      url: data.url,
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
    sourceModule: "gsc",
    entityType: "page" as const,
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
      url: data.url,
      status: "open",
    },
  });
}

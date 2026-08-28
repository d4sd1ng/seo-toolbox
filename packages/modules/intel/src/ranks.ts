import { prisma, workspacePlanCaps } from "db";
import { fetchOrganicSerp } from "./provider";

export async function runRankCheck(input: {
  projectId: string;
  workspaceId: string;
  jobId: string;
  limit?: number;
}) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  const caps = await workspacePlanCaps(input.workspaceId);
  const keywords = await prisma.keyword.findMany({
    where: { projectId: project.id },
    orderBy: { volume: "desc" },
    take: Math.min(input.limit ?? caps.rankKeywordsPerRun, caps.rankKeywordsPerRun),
  });
  if (keywords.length === 0) throw new Error("Keine Keywords zum Tracken.");

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "running", startedAt: new Date(), progress: 5 },
  });

  const host = project.primaryDomain.replace(/^www\./, "");
  let checked = 0;
  let drops = 0;

  for (const kw of keywords) {
    const serp = await fetchOrganicSerp(kw.phrase);
    const hit = serp.find((row) => row.domain === host || row.url.includes(host));
    const last = await prisma.rankResult.findFirst({
      where: { keywordId: kw.id },
      orderBy: { checkedAt: "desc" },
    });
    const position = hit?.position ?? null;
    await prisma.rankResult.create({
      data: {
        projectId: project.id,
        keywordId: kw.id,
        engine: "GOOGLE",
        location: "DE",
        position,
        url: hit?.url ?? null,
        previousPosition: last?.position ?? null,
        serpFeatures: [],
      },
    });
    if (last?.position != null && position != null && position - last.position >= 5) {
      drops += 1;
      const existing = await prisma.issue.findFirst({
        where: {
          projectId: project.id,
          type: "rank_drop",
          entityId: kw.id,
          status: { in: ["open", "snoozed"] },
        },
      });
      const issueData = {
        title: `Ranking-Verlust: „${kw.phrase}“`,
        description: `Von ${last.position} auf ${position}.`,
        recommendation: "Seite und SERP prüfen: Snippet, Intent, neue Wettbewerber.",
        severity: "high" as const,
        effort: "m" as const,
        priorityScore: 3,
        url: hit?.url ?? kw.currentUrl,
        evidence: { previous: last.position, current: position },
      };
      if (existing) {
        await prisma.issue.update({ where: { id: existing.id }, data: issueData });
      } else {
        await prisma.issue.create({
          data: {
            ...issueData,
            projectId: project.id,
            type: "rank_drop",
            status: "open",
            entityType: "keyword",
            entityId: kw.id,
            sourceModule: "ranks",
          },
        });
      }
    }
    checked += 1;
    await prisma.job.update({
      where: { id: input.jobId },
      data: { progress: Math.min(95, Math.round((checked / keywords.length) * 90)) },
    });
  }

  await prisma.serpSnapshot.create({
    data: {
      projectId: project.id,
      query: `${checked} keywords`,
      features: [],
      results: [],
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      resultSummary: `${checked} Keywords geprüft, ${drops} Verluste ≥5`,
    },
  });
  return { checked, drops };
}

import { prisma } from "db";
import { dfsPost, hasDataForSeo } from "./provider";

export async function runBacklinkSync(input: {
  projectId: string;
  workspaceId: string;
  jobId: string;
  target?: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
  const target = input.target ?? project.primaryDomain;

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "running", startedAt: new Date(), progress: 20 },
  });

  if (!hasDataForSeo()) {
    throw new Error("Backlinks brauchen DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD.");
  }

  const json = await dfsPost<{
    tasks?: Array<{
      result?: Array<{
        referring_domains?: number;
        backlinks?: number;
        broken_backlinks?: number;
        referring_domains_nofollow?: number;
      }>;
    }>;
  }>("/v3/backlinks/summary/live", [{ target, include_subdomains: true }]);

  const summary = json.tasks?.[0]?.result?.[0] ?? {};
  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      resultSummary: `${summary.referring_domains ?? 0} Ref. Domains · ${summary.backlinks ?? 0} Links`,
    },
  });

  if ((summary.broken_backlinks ?? 0) > 0) {
    await prisma.issue.create({
      data: {
        projectId: project.id,
        type: "broken_backlinks",
        title: `${summary.broken_backlinks} kaputte Backlinks`,
        description: `DataForSEO Summary für ${target}.`,
        recommendation: "Ziele umleiten oder Webmaster um Update bitten.",
        severity: "medium",
        effort: "m",
        priorityScore: 2,
        status: "open",
        entityType: "backlink",
        url: `https://${target}`,
        sourceModule: "backlinks",
        evidence: summary as object,
      },
    });
  }

  return summary;
}

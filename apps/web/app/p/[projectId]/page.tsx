import Link from "next/link";
import { prisma, workspaceUsage } from "db";
import { IssueActions } from "./issues/actions";

export const dynamic = "force-dynamic";

export default async function ProjectOverview({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId: rawId } = await params;
  const projectId = decodeURIComponent(rawId);
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, primaryDomain: true, workspaceId: true },
  });
  if (!project) {
    return (
      <main style={{ padding: 32 }}>
        <p>Projekt fehlt.</p>
        <Link href="/">Zur Übersicht</Link>
      </main>
    );
  }

  const [openIssues, lastAudit, lastCrawl, daily, activeJobs, usage] = await Promise.all([
    prisma.issue.findMany({
      where: { projectId, status: { in: ["open", "snoozed"] } },
      orderBy: { priorityScore: "desc" },
      take: 8,
      select: {
        id: true,
        title: true,
        severity: true,
        effort: true,
        sourceModule: true,
        url: true,
      },
    }),
    prisma.onPageAudit.findFirst({
      where: { projectId },
      orderBy: { fetchedAt: "desc" },
      select: { score: true },
    }),
    prisma.crawl.findFirst({
      where: { projectId },
      orderBy: { startedAt: "desc" },
      select: { pagesCrawled: true },
    }),
    prisma.searchPerformance.findMany({
      where: { projectId, query: "", pageUrl: "" },
      orderBy: { date: "desc" },
      take: 28,
      select: { clicks: true, impressions: true },
    }),
    prisma.job.findMany({
      where: { projectId, status: { in: ["queued", "running"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { type: true },
    }),
    workspaceUsage(project.workspaceId).catch(() => null),
  ]);
  const clicks = daily.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = daily.reduce((sum, row) => sum + row.impressions, 0);
  const jobsLeft = usage?.quotas.find((q) => q.key === "concurrentJobs");

  return (
    <main style={{ padding: 32, maxWidth: 880 }}>
      <h1>{project.name}</h1>
      <p style={{ color: "#555" }}>
        {project.primaryDomain}
        {daily.length > 0 ? ` · ${clicks} Klicks / ${impressions} Imp. (28 Tage)` : ""}
        {lastAudit ? ` · On-Page ${lastAudit.score}` : ""}
        {lastCrawl ? ` · Crawl ${lastCrawl.pagesCrawled} URLs` : ""}
      </p>

      {activeJobs.length > 0 ? (
        <p>
          Erste Prüfung läuft ({activeJobs.map((j) => j.type.replace("_", " ")).join(", ")}).
          Die Inbox füllt sich in Kürze.
        </p>
      ) : null}

      <p style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link href={`/p/${projectId}/issues`}>Inbox ({openIssues.length})</Link>
        <Link href={`/p/${projectId}/onpage`}>On-Page</Link>
        <Link href={`/p/${projectId}/crawl`}>Crawl</Link>
        <Link href={`/p/${projectId}/gsc`}>Search Console</Link>
      </p>

      <h2>Als Nächstes</h2>
      {openIssues.length === 0 ? (
        <p>
          {activeJobs.length > 0
            ? "Noch keine Issues — die erste Analyse ist unterwegs."
            : "Keine offenen Issues."}{" "}
          <Link href={`/p/${projectId}/onpage`}>Seite prüfen</Link>
          {jobsLeft?.remaining === 0 ? " · Limit für parallele Prüfungen erreicht" : ""}
        </p>
      ) : (
        <ol style={{ paddingLeft: 20 }}>
          {openIssues.map((issue) => (
            <li key={issue.id} style={{ marginBottom: 12 }}>
              <strong>{issue.title}</strong>
              <div style={{ fontSize: 13, color: "#555" }}>
                {issue.severity} · {issue.effort} · {issue.sourceModule}
                {issue.url ? ` · ${issue.url}` : ""}
              </div>
              <IssueActions issueId={issue.id} />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

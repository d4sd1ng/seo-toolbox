import { prisma } from "db";
import { GscActions } from "./ui";

export default async function GscPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId: project.workspaceId, provider: "gsc" } },
  });

  const endDateRow = await prisma.searchPerformance.findFirst({
    where: { projectId, query: "", pageUrl: "" },
    orderBy: { date: "desc" },
  });

  const totals = await prisma.searchPerformance.findMany({
    where: { projectId, query: "", pageUrl: "" },
    orderBy: { date: "desc" },
    take: 28,
  });

  const topQueries = await prisma.searchPerformance.findMany({
    where: { projectId, pageUrl: "", query: { not: "" } },
    orderBy: { impressions: "desc" },
    take: 15,
  });

  const clicks = totals.reduce((sum, row) => sum + row.clicks, 0);
  const impressions = totals.reduce((sum, row) => sum + row.impressions, 0);

  return (
    <main style={{ padding: 32, maxWidth: 920 }}>
      <h1>Search Console</h1>
      <p>
        Status: {integration?.status ?? "nicht verbunden"}
        {project.gscSiteUrl ? ` · Property ${project.gscSiteUrl}` : ""}
        {integration?.lastSyncAt
          ? ` · letzter Sync ${integration.lastSyncAt.toISOString()}`
          : ""}
      </p>
      <GscActions
        projectId={projectId}
        connected={integration?.status === "connected"}
        hasProperty={Boolean(project.gscSiteUrl)}
      />
      <section>
        <h2>28 Tage</h2>
        {totals.length === 0 ? (
          <p>Noch keine Daten. Verbinden, Property wählen, dann Sync.</p>
        ) : (
          <p>
            {clicks} Klicks · {impressions} Impressions
            {endDateRow ? ` · letzter Tag ${endDateRow.date.toISOString().slice(0, 10)}` : ""}
          </p>
        )}
      </section>
      <section>
        <h2>Top Queries</h2>
        <ol>
          {topQueries.map((row) => (
            <li key={row.id}>
              {row.query} · {row.clicks} Klicks · {row.impressions} Impr. · Pos.{" "}
              {row.position.toFixed(1)}
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

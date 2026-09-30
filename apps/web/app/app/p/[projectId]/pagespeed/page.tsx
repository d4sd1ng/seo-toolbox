import { prisma } from "db";
import { PageSpeedForm } from "./ui";

export default async function PageSpeedPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const jobs = await prisma.job.findMany({
    where: { projectId, type: "pagespeed" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  const issues = await prisma.issue.findMany({
    where: { projectId, sourceModule: "pagespeed", status: "open" },
    orderBy: { priorityScore: "desc" },
  });

  return (
    <main style={{ padding: 32, maxWidth: 840 }}>
      <h1>PageSpeed / CWV</h1>
      <p>Felddaten aus CrUX, wo vorhanden, sonst Laborscore. Issues landen in der Inbox.</p>
      <PageSpeedForm projectId={projectId} defaultUrl={project.homepageUrl} />
      <h2>Letzte Läufe</h2>
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            {job.status} · {job.resultSummary ?? "–"}
          </li>
        ))}
      </ul>
      <h2>Offene CWV-Issues</h2>
      <ul>
        {issues.map((issue) => (
          <li key={issue.id}>
            {issue.title} · {issue.url}
          </li>
        ))}
      </ul>
    </main>
  );
}

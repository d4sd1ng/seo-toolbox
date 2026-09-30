import { prisma } from "db";
import { OnPageForm } from "./ui";

export default async function OnPagePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const latest = await prisma.onPageAudit.findMany({
    where: { projectId },
    orderBy: { fetchedAt: "desc" },
    take: 8,
  });

  return (
    <main style={{ padding: 32, maxWidth: 840 }}>
      <h1>On-Page Audit</h1>
      <OnPageForm projectId={projectId} defaultUrl={project.homepageUrl} />
      <h2>Letzte Läufe</h2>
      <ul>
        {latest.map((audit) => (
          <li key={audit.id}>
            Score {audit.score} · {audit.url}
          </li>
        ))}
      </ul>
    </main>
  );
}

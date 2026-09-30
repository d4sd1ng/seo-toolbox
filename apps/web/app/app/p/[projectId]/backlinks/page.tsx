import { prisma } from "db";
import { JobForm } from "@/app/components/job-form";

export default async function BacklinksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const jobs = await prisma.job.findMany({
    where: { projectId, type: "backlink_sync" },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1>Backlinks</h1>
      <p>Domain-Summary über DataForSEO. Kein eigener Linkindex.</p>
      <JobForm action={`/api/projects/${projectId}/backlinks`} fields={[]} label="Summary holen" />
      <ul>
        {jobs.map((job) => (
          <li key={job.id}>
            {job.status} · {job.resultSummary ?? "–"}
          </li>
        ))}
      </ul>
    </main>
  );
}

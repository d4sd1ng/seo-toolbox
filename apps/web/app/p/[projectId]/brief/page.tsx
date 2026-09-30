import { prisma } from "db";
import { JobForm } from "@/app/components/job-form";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const briefs = await prisma.contentBrief.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { keyword: true },
  });
  return (
    <main style={{ padding: 32, maxWidth: 800 }}>
      <h1>Content-Brief</h1>
      <p>Top-10-SERP → Outline, Entitäten, Fragen. Kein Writer, nur Brief.</p>
      <JobForm
        action={`/api/projects/${projectId}/brief`}
        fields={[{ name: "keyword", placeholder: "Ziel-Keyword" }]}
        label="Brief erzeugen"
      />
      {briefs.map((brief) => (
        <article key={brief.id} style={{ marginBottom: 24 }}>
          <h2>{brief.keyword.phrase}</h2>
          <p>Ziel-Länge {brief.wordCountTarget ?? "–"} Wörter</p>
          <h3>Outline</h3>
          <ul>
            {brief.headingOutline.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
          <h3>Entitäten</h3>
          <p>{brief.entities.join(", ") || "–"}</p>
        </article>
      ))}
    </main>
  );
}

import { JobForm } from "@/app/components/job-form";

export default async function ResearchPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  return (
    <main style={{ padding: 32, maxWidth: 720 }}>
      <h1>Keyword-Recherche</h1>
      <p>
        DataForSEO Labs + Search Volume. Ohne Keys wird nur das Seed-Keyword angelegt.
        Volume/KD brauchen DATAFORSEO_LOGIN und DATAFORSEO_PASSWORD.
      </p>
      <JobForm
        action={`/api/projects/${projectId}/research`}
        fields={[{ name: "seed", placeholder: "z.B. wärmepumpe kosten" }]}
        label="Recherchieren"
      />
    </main>
  );
}

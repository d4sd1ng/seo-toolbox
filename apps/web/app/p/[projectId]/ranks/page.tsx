import { prisma } from "db";
import { JobForm } from "@/app/components/job-form";

export default async function RanksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const latest = await prisma.rankResult.findMany({
    where: { projectId },
    orderBy: { checkedAt: "desc" },
    take: 40,
    include: { keyword: true },
  });
  return (
    <main style={{ padding: 32 }}>
      <h1>Rank Tracker</h1>
      <p>Prüft bis zu 25 Keywords (Volume zuerst) über DataForSEO oder Serper.</p>
      <JobForm action={`/api/projects/${projectId}/ranks`} fields={[]} label="Rankings prüfen" />
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Keyword</th>
            <th align="left">Pos.</th>
            <th align="left">Vorher</th>
            <th align="left">URL</th>
          </tr>
        </thead>
        <tbody>
          {latest.map((row) => (
            <tr key={row.id}>
              <td>{row.keyword.phrase}</td>
              <td>{row.position ?? "–"}</td>
              <td>{row.previousPosition ?? "–"}</td>
              <td>{row.url}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

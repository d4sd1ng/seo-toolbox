import { prisma } from "db";

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const keywords = await prisma.keyword.findMany({
    where: { projectId },
    orderBy: { volume: "desc" },
    take: 100,
  });

  return (
    <main style={{ padding: 32 }}>
      <h1>Keywords</h1>
      <p>
        Kommen aktuell aus dem GSC-Sync (Top-Queries). Externe Volume-APIs kommen später.
      </p>
      {keywords.length === 0 ? (
        <p>Noch keine Keywords. Search Console synchronisieren.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Keyword</th>
              <th align="left">Quelle</th>
              <th align="left">Impr. (GSC)</th>
            </tr>
          </thead>
          <tbody>
            {keywords.map((kw) => (
              <tr key={kw.id}>
                <td>{kw.phrase}</td>
                <td>{kw.source}</td>
                <td>{kw.volume ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

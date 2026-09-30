import { prisma } from "db";
import { IssueActions } from "./actions";

export default async function IssuesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const issues = await prisma.issue.findMany({
    where: { projectId, status: { in: ["open", "snoozed", "in_progress"] } },
    orderBy: { priorityScore: "desc" },
    take: 100,
  });

  return (
    <main style={{ padding: 32 }}>
      <h1>Issues</h1>
      <p>Eine Arbeitsliste für alle Module. Haken = erledigt, nicht „in Tool X nachschauen“.</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th align="left">Problem</th>
            <th align="left">Schwere</th>
            <th align="left">Aufwand</th>
            <th align="left">Modul</th>
            <th align="left">URL</th>
            <th align="left">Aktion</th>
          </tr>
        </thead>
        <tbody>
          {issues.map((issue) => (
            <tr key={issue.id}>
              <td>
                <strong>{issue.title}</strong>
                <div style={{ color: "#555", fontSize: 13 }}>{issue.recommendation}</div>
              </td>
              <td>{issue.severity}</td>
              <td>{issue.effort}</td>
              <td>{issue.sourceModule}</td>
              <td>{issue.url}</td>
              <td>
                <IssueActions issueId={issue.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

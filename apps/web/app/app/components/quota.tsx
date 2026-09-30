import type { QuotaRow } from "db";

const LABELS: Record<string, string> = {
  projects: "Projekte",
  members: "Mitglieder",
  keywordsTracked: "Keywords",
  concurrentJobs: "Parallele Jobs",
  crawlsPerDay: "Crawls heute",
  onpagePerDay: "On-Page heute",
  gscSyncsPerDay: "GSC-Syncs heute",
  rankRunsPerDay: "Rank-Läufe heute",
  pagespeedPerDay: "PageSpeed heute",
  researchPerDay: "Recherche heute",
  backlinkSyncsPerDay: "Backlink-Syncs heute",
};

export function QuotaList({ quotas }: { quotas: QuotaRow[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0 }}>
      {quotas.map((q) => (
        <li key={q.key} style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <span>{LABELS[q.key] ?? q.key}</span>
          <span>
            {q.used} / {q.limit}
            {q.remaining === 0 ? " · voll" : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

import Link from "next/link";
import type { QuotaRow } from "db";
import { pickHeaderQuotas } from "@/lib/quota";

const SHORT: Record<string, string> = {
  concurrentJobs: "Jobs",
  crawlsPerDay: "Crawl",
  rankRunsPerDay: "Rank",
  onpagePerDay: "OnPage",
  keywordsTracked: "KW",
};

export function QuotaHeader({
  plan,
  quotas,
}: {
  plan: string;
  quotas: QuotaRow[];
}) {
  const items = pickHeaderQuotas(quotas);
  return (
    <header
      style={{
        display: "flex",
        gap: 16,
        alignItems: "center",
        flexWrap: "wrap",
        padding: "8px 20px",
        borderBottom: "1px solid #e5e5e5",
        fontSize: 13,
        background: "#fafafa",
      }}
    >
      <strong style={{ textTransform: "uppercase" }}>{plan}</strong>
      {items.map((q) => (
        <span key={q.key} style={{ color: q.remaining === 0 ? "#b42318" : "#333" }}>
          {SHORT[q.key] ?? q.key} {q.used}/{q.limit}
        </span>
      ))}
      <Link href="/settings" style={{ marginLeft: "auto" }}>
        Limits
      </Link>
    </header>
  );
}

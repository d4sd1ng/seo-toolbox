"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { JobStatus, useJob } from "@/app/components/job-poller";

export function PageSpeedForm({
  projectId,
  defaultUrl,
}: {
  projectId: string;
  defaultUrl: string;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(defaultUrl);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);
  const job = useJob(jobId, refresh);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/pagespeed`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, strategy: "mobile" }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Start fehlgeschlagen");
      return;
    }
    setJobId(data.jobId);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, margin: "16px 0 28px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1, padding: 8 }} />
        <button type="submit">Prüfen</button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <JobStatus job={job} />
    </form>
  );
}

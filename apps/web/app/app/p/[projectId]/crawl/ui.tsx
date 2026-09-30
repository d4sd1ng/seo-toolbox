"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { JobStatus, useJob } from "@/app/components/job-poller";

export function CrawlForm({
  projectId,
  defaultUrl,
  defaultMax,
}: {
  projectId: string;
  defaultUrl: string;
  defaultMax: number;
}) {
  const router = useRouter();
  const [seedUrl, setSeedUrl] = useState(defaultUrl);
  const [maxUrls, setMaxUrls] = useState(defaultMax);
  const [renderJavascript, setRenderJavascript] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);
  const job = useJob(jobId, refresh);
  const running = job?.status === "queued" || job?.status === "running";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/crawls`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ seedUrl, maxUrls, renderJavascript }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Crawl konnte nicht gestartet werden");
      return;
    }
    setJobId(data.jobId);
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, margin: "16px 0 28px" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={seedUrl}
          onChange={(e) => setSeedUrl(e.target.value)}
          style={{ flex: 1, minWidth: 240, padding: 8 }}
        />
        <input
          type="number"
          min={1}
          max={defaultMax}
          value={maxUrls}
          onChange={(e) => setMaxUrls(Number(e.target.value))}
          style={{ width: 120, padding: 8 }}
        />
        <button disabled={running} type="submit">
          Crawl starten
        </button>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={renderJavascript}
          onChange={(e) => setRenderJavascript(e.target.checked)}
        />
        JavaScript rendern (Hybrid, Limit je Plan, langsam)
      </label>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <JobStatus job={job} />
    </form>
  );
}

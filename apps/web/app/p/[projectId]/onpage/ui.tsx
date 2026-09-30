"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { JobStatus, useJob } from "@/app/components/job-poller";

export function OnPageForm({
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
  const [pending, setPending] = useState(false);

  const refresh = useCallback(() => router.refresh(), [router]);
  const job = useJob(jobId, refresh);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/onpage`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const text = await res.text();
      let data: { jobId?: string; id?: string; error?: string; status?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setError(`Server ${res.status}`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Audit fehlgeschlagen (${res.status})`);
        return;
      }
      const id = data.jobId ?? data.id;
      if (!id) {
        setError("Job gestartet, aber ohne ID.");
        return;
      }
      setJobId(id);
    } catch {
      setError("Keine Verbindung. API oder Login prüfen.");
    } finally {
      setPending(false);
    }
  }

  const running =
    pending || job?.status === "queued" || job?.status === "running" || (Boolean(jobId) && !job);

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, margin: "16px 0 32px" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          style={{ flex: 1, padding: 8 }}
          placeholder="https://example.de/seite"
        />
        <button disabled={running} type="submit">
          {running ? "Läuft…" : "Audit starten"}
        </button>
      </div>
      {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
      {jobId && !job ? <p>Job {jobId} in der Queue…</p> : null}
      <JobStatus job={job} />
    </form>
  );
}

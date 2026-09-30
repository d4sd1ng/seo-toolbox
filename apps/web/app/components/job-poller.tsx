"use client";

import { useEffect, useState } from "react";

type JobState = {
  id: string;
  status: string;
  progress: number;
  error: string | null;
  resultSummary: string | null;
};

export function useJob(jobId: string | null, onDone?: () => void) {
  const [job, setJob] = useState<JobState | null>(null);

  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/jobs/${jobId}`, { credentials: "include" });
        if (cancelled) return;
        if (!res.ok) {
          setJob({
            id: jobId,
            status: "failed",
            progress: 0,
            error: res.status === 401 ? "Bitte neu anmelden." : "Prüfung konnte nicht geladen werden.",
            resultSummary: null,
          });
          return;
        }
        const data = (await res.json()) as JobState;
        setJob(data);
        if (data.status === "succeeded" || data.status === "failed") {
          onDone?.();
          return;
        }
      } catch {
        if (!cancelled) {
          setJob({
            id: jobId,
            status: "queued",
            progress: 0,
            error: null,
            resultSummary: "Wird vorbereitet…",
          });
        }
      }
      window.setTimeout(tick, 1200);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [jobId, onDone]);

  return job;
}

export function JobStatus({ job }: { job: JobState | null }) {
  if (!job) return null;
  if (job.status === "failed") {
    return <p style={{ color: "crimson" }}>{job.error ?? "Prüfung fehlgeschlagen"}</p>;
  }
  return (
    <p>
      {label(job.status)}
      {job.progress > 0 ? ` · ${job.progress}%` : ""}
      {job.resultSummary ? ` · ${job.resultSummary}` : ""}
    </p>
  );
}

function label(status: string) {
  if (status === "queued") return "In Bearbeitung";
  if (status === "running") return "Analyse läuft";
  if (status === "succeeded") return "Fertig";
  return status;
}

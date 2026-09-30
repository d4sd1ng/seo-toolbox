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
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok || cancelled) return;
      const data = (await res.json()) as JobState;
      setJob(data);
      if (data.status === "succeeded" || data.status === "failed") {
        onDone?.();
        return;
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
    return <p style={{ color: "crimson" }}>{job.error ?? "Job fehlgeschlagen"}</p>;
  }
  return (
    <p>
      {label(job.status)} · {job.progress}%
      {job.resultSummary ? ` · ${job.resultSummary}` : ""}
    </p>
  );
}

function label(status: string) {
  if (status === "queued") return "In der Queue";
  if (status === "running") return "Läuft";
  if (status === "succeeded") return "Fertig";
  return status;
}

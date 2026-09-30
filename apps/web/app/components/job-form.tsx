"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { JobStatus, useJob } from "@/app/components/job-poller";

export function JobForm({
  action,
  fields,
  label,
}: {
  action: string;
  fields: Array<{ name: string; placeholder: string; defaultValue?: string }>;
  label: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.defaultValue ?? ""])),
  );
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
      const res = await fetch(action, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = (await res.json().catch(() => ({}))) as {
        jobId?: string;
        id?: string;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Start fehlgeschlagen");
        return;
      }
      const id = data.jobId ?? data.id;
      if (!id) {
        setError("Keine Job-ID in der Antwort.");
        return;
      }
      setJobId(id);
    } catch {
      setError("Keine Verbindung zum Server.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, margin: "16px 0 24px" }}>
      {fields.map((field) => (
        <input
          key={field.name}
          value={values[field.name] ?? ""}
          placeholder={field.placeholder}
          onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
        />
      ))}
      <button type="submit" disabled={pending}>
        {pending ? "Startet…" : label}
      </button>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      {jobId && !job ? <p>In der Queue…</p> : null}
      <JobStatus job={job} />
    </form>
  );
}

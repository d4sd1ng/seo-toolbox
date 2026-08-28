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
  const refresh = useCallback(() => router.refresh(), [router]);
  const job = useJob(jobId, refresh);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(action, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Start fehlgeschlagen");
      return;
    }
    setJobId(data.jobId);
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
      <button type="submit">{label}</button>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <JobStatus job={job} />
    </form>
  );
}

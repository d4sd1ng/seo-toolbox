"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { JobStatus, useJob } from "@/app/components/job-poller";

type Site = { siteUrl: string; permissionLevel: string };

export function GscActions({
  projectId,
  connected,
  hasProperty,
}: {
  projectId: string;
  connected: boolean;
  hasProperty: boolean;
}) {
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [selected, setSelected] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);
  const job = useJob(jobId, refresh);

  useEffect(() => {
    if (!connected) return;
    fetch(`/api/projects/${projectId}/gsc/sites`)
      .then((res) => res.json())
      .then((data) => {
        if (data.sites) setSites(data.sites);
        if (data.selected) setSelected(data.selected);
      });
  }, [connected, projectId]);

  async function attach() {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/gsc/attach`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ siteUrl: selected }),
    });
    const data = await res.json();
    if (!res.ok) setError(data.error);
    else refresh();
  }

  async function sync() {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/gsc/sync`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setJobId(data.jobId);
  }

  return (
    <div style={{ display: "grid", gap: 12, margin: "16px 0 28px" }}>
      {!connected ? (
        <a href={`/api/integrations/gsc/start?projectId=${projectId}`}>
          Google Search Console verbinden
        </a>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Property wählen</option>
              {sites.map((site) => (
                <option key={site.siteUrl} value={site.siteUrl}>
                  {site.siteUrl}
                </option>
              ))}
            </select>
            <button type="button" onClick={attach} disabled={!selected}>
              Zuordnen
            </button>
            <button type="button" onClick={sync} disabled={!hasProperty}>
              Sync starten
            </button>
          </div>
          <JobStatus job={job} />
        </>
      )}
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";

export function IssueActions({ issueId }: { issueId: string }) {
  const router = useRouter();

  async function setStatus(status: string) {
    await fetch(`/api/issues/${issueId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  return (
    <span style={{ display: "flex", gap: 6, whiteSpace: "nowrap" }}>
      <button type="button" onClick={() => setStatus("done")}>
        Erledigt
      </button>
      <button type="button" onClick={() => setStatus("snoozed")}>
        7 Tage
      </button>
      <button type="button" onClick={() => setStatus("ignored")}>
        Ignorieren
      </button>
    </span>
  );
}

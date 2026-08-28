"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function NewProjectForm() {
  const router = useRouter();
  const [url, setUrl] = useState("https://");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, name }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Anlegen fehlgeschlagen");
      return;
    }
    router.push(`/p/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, margin: "16px 0 28px" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.de"
          style={{ flex: 1, padding: 8 }}
        />
        <button disabled={busy} type="submit">
          Projekt anlegen
        </button>
      </div>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </form>
  );
}

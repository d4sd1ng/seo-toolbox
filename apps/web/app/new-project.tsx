"use client";

import { useState } from "react";

export function NewProjectForm() {
  const [url, setUrl] = useState("https://");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, name }),
      });
      const text = await res.text();
      let data: { id?: string; error?: string } = {};
      try {
        data = text ? (JSON.parse(text) as { id?: string; error?: string }) : {};
      } catch {
        setError("Anlage fehlgeschlagen. Bitte erneut versuchen.");
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Anlage fehlgeschlagen");
        return;
      }
      if (!data.id) {
        setError("Projekt ohne ID — bitte neu laden.");
        return;
      }
      window.location.href = `/p/${data.id}`;
    } catch {
      setError("Keine Verbindung. Bitte Seite neu laden.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 8, margin: "16px 0 28px" }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (optional)" />
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://kunde.de"
          style={{ flex: 1, padding: 8 }}
        />
        <button disabled={busy} type="submit">
          {busy ? "Startet Prüfung…" : "Projekt anlegen"}
        </button>
      </div>
      <p style={{ color: "#555", fontSize: 13, margin: 0 }}>
        On-Page und Crawl starten automatisch.
      </p>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
    </form>
  );
}

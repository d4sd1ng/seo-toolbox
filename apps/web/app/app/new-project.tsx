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
        setError(`Server ${res.status}: ${text.slice(0, 160) || "keine JSON-Antwort"}`);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? `Anlegen fehlgeschlagen (${res.status})`);
        return;
      }
      if (!data.id) {
        setError("Projekt angelegt, aber keine ID in der Antwort.");
        return;
      }
      window.location.href = `/p/${data.id}`;
    } catch {
      setError("Keine Verbindung zum Server.");
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

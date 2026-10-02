"use client";

import { useEffect, useState } from "react";

const tools = [
  { id: "audit", label: "SEO-Audit", field: "url", placeholder: "https://beispiel.de" },
  { id: "keyword-check", label: "Keyword-Check", field: "seed", placeholder: "Suchbegriff" },
  { id: "robots-sitemap", label: "Robots & Sitemap", field: "url", placeholder: "https://beispiel.de" },
  { id: "crawl-demo", label: "Crawl-Demo", field: "url", placeholder: "https://beispiel.de" },
  { id: "gsc-preview", label: "GSC-Vorschau", field: "projectId", placeholder: "Projekt auswählen" },
] as const;

type Tool = (typeof tools)[number];
type ToolStatus = {
  available: boolean;
  limit: number | null;
  remaining: number | null;
  resetAt: string;
  gateRequired: boolean;
  plan: string;
  projects: Array<{ id: string; name: string; gscSiteUrl: string }>;
};
type Result =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: unknown }
  | { kind: "error"; message: string; loginUrl?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseStatus(value: unknown): ToolStatus | null {
  if (!isRecord(value)) return null;
  if (
    typeof value.available !== "boolean" ||
    (value.limit !== null && typeof value.limit !== "number") ||
    (value.remaining !== null && typeof value.remaining !== "number") ||
    typeof value.resetAt !== "string" ||
    typeof value.gateRequired !== "boolean" ||
    typeof value.plan !== "string" ||
    !Array.isArray(value.projects)
  ) return null;
  return {
    available: value.available,
    limit: value.limit,
    remaining: value.remaining,
    resetAt: value.resetAt,
    gateRequired: value.gateRequired,
    plan: value.plan,
    projects: value.projects.filter((project): project is { id: string; name: string; gscSiteUrl: string } =>
      isRecord(project) && typeof project.id === "string" && typeof project.name === "string" && typeof project.gscSiteUrl === "string"),
  };
}

function messageFrom(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

export function ToolboxWidget() {
  const [selected, setSelected] = useState<Tool>(tools[0]);
  const [status, setStatus] = useState<ToolStatus | null>(null);
  const [statusError, setStatusError] = useState("");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("owner") === "1") setSelected(tools[4]);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && window.parent !== window) {
        window.parent.postMessage("nv-seo-close", "*");
      }
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    let active = true;
    setStatus(null);
    setStatusError("");
    fetch(`/api/tools/${selected.id}`, { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json();
        if (!response.ok) throw new Error(messageFrom(body, "Limit konnte nicht geladen werden."));
        const parsed = parseStatus(body);
        if (!parsed) throw new Error("Limit konnte nicht gelesen werden.");
        if (active) setStatus(parsed);
      })
      .catch((error: unknown) => {
        if (active) setStatusError(error instanceof Error ? error.message : "Limit konnte nicht geladen werden.");
      });
    return () => { active = false; };
  }, [selected, result.kind]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult({ kind: "loading" });
    try {
      const response = await fetch(`/api/tools/${selected.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ [selected.field]: input.trim() }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const loginUrl = response.status === 401 && isRecord(body) && typeof body.loginUrl === "string"
          ? body.loginUrl
          : undefined;
        setResult({ kind: "error", message: messageFrom(body, "Prüfung fehlgeschlagen."), loginUrl });
        return;
      }
      setResult({ kind: "success", data: isRecord(body) && "data" in body ? body.data : body });
    } catch {
      setResult({ kind: "error", message: "Die Prüfung ist derzeit nicht erreichbar." });
    }
  }

  function select(tool: Tool) {
    setSelected(tool);
    setInput("");
    setResult({ kind: "idle" });
  }

  return (
    <main className="nv-toolbox">
      <header className="nv-toolbox__header">
        <p className="nv-toolbox__eyebrow">NUROVELLE SEO-TOOLBOX</p>
        <h1>Kostenloser SEO-Check</h1>
      </header>
      <div className="nv-toolbox__tabs" role="tablist" aria-label="SEO-Tools">
        {tools.map((tool) => (
          <button key={tool.id} id={`tab-${tool.id}`} type="button" role="tab"
            aria-selected={selected.id === tool.id} aria-controls="nv-toolbox-panel"
            tabIndex={selected.id === tool.id ? 0 : -1}
            onClick={() => select(tool)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const index = tools.findIndex((item) => item.id === selected.id);
              const next = tools[(index + (event.key === "ArrowRight" ? 1 : tools.length - 1)) % tools.length];
              select(next);
              document.getElementById(`tab-${next.id}`)?.focus();
            }}>
            {tool.label}
          </button>
        ))}
      </div>
      <section id="nv-toolbox-panel" role="tabpanel" aria-labelledby={`tab-${selected.id}`} className="nv-toolbox__panel">
        <div className="nv-toolbox__limit" aria-live="polite">
          {statusError || (status ? (
            status.available
              ? status.limit === null
                ? "Ohne Stundenlimit"
                : `${status.remaining} von ${status.limit} Nutzungen in dieser Stunde übrig${status.gateRequired ? " · Anmeldung erforderlich" : ""}`
              : "In diesem Tarif nicht verfügbar"
          ) : "Limit wird geladen …")}
        </div>
        {status?.available ? (
          <form onSubmit={submit} className="nv-toolbox__form">
            <label htmlFor="nv-toolbox-input">{selected.field === "seed" ? "Suchbegriff" : selected.field === "projectId" ? "GSC-Projekt" : "Website-URL"}</label>
            <div className="nv-toolbox__input-row">
              {selected.field === "projectId" ? (
                <select id="nv-toolbox-input" value={input} onChange={(event) => setInput(event.target.value)} required>
                  <option value="">Projekt auswählen</option>
                  {status.projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                </select>
              ) : (
                <input id="nv-toolbox-input" value={input} onChange={(event) => setInput(event.target.value)}
                  type={selected.field === "url" ? "url" : "text"} placeholder={selected.placeholder}
                  required autoComplete="off" />
              )}
              <button type="submit" disabled={result.kind === "loading" || (status.remaining !== null && status.remaining < 1)}>
                {result.kind === "loading" ? "Prüfung läuft …" : "Jetzt prüfen"}
              </button>
            </div>
          </form>
        ) : null}
        {status?.available && selected.field === "projectId" && status.projects.length === 0 ? (
          <p>Kein verbundenes GSC-Projekt im aktuellen Workspace vorhanden.</p>
        ) : null}
        {status && !status.available ? <p>Dieses Tool ist in deinem aktuellen Tarif nicht verfügbar.</p> : null}
        {result.kind === "error" ? (
          <div className="nv-toolbox__message" role="alert">
            <p>{result.message}</p>
            {result.loginUrl ? <a href={result.loginUrl} target="_top">Anmelden oder Konto anlegen</a> : null}
          </div>
        ) : null}
        {result.kind === "success" ? (
          <div className="nv-toolbox__result" role="status">
            <h2>Ergebnis</h2>
            <pre>{JSON.stringify(result.data, null, 2)}</pre>
          </div>
        ) : null}
      </section>
      <footer className="nv-toolbox__footer">
        <a href="/preise" target="_top">Pläne ansehen</a>
        <a href="/api/auth/google/start?return=homepage" target="_top">Owner-Login</a>
      </footer>
    </main>
  );
}

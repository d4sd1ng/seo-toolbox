"use client";

import { useEffect, useRef, useState } from "react";
import { isRecord, parseToolResult, ToolResults, type ToolResult } from "./widget-results";

const tools = [
  {
    id: "audit",
    label: "SEO-Audit",
    field: "url",
    placeholder: "https://beispiel.de",
    hint: "Prüft eine einzelne Seite auf grundlegende SEO-Auffälligkeiten. Gib eine öffentliche HTTPS-Adresse ein.",
  },
  {
    id: "keyword-check",
    label: "Keyword-Check",
    field: "seed",
    placeholder: "Suchbegriff",
    hint: "Liefert Keyword-Ideen zu deinem Suchbegriff. Gib 1 bis 120 Zeichen ein.",
  },
  {
    id: "robots-sitemap",
    label: "Robots & Sitemap",
    field: "url",
    placeholder: "https://beispiel.de",
    hint: "Prüft die Erreichbarkeit von /robots.txt und /sitemap.xml deiner Website.",
  },
  {
    id: "crawl-demo",
    label: "Crawl-Demo",
    field: "url",
    placeholder: "https://beispiel.de",
    hint: "Prüft bis zu drei intern verlinkte Seiten. Je nach Website kann der Abruf etwas dauern.",
  },
  {
    id: "gsc-preview",
    label: "GSC-Vorschau",
    field: "projectId",
    placeholder: "Projekt auswählen",
    hint: "Zeigt Suchanfragen eines verbundenen Search-Console-Projekts aus deinem Workspace.",
  },
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
  | { kind: "success"; data: ToolResult }
  | { kind: "error"; message: string; action: "login" | "plans" | "retry" | "wait" };
const LOGIN_URL = "/login?next=%2Ftoolbox%2Fembed";

function nonnegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function parseStatus(value: unknown): ToolStatus | null {
  if (
    !isRecord(value) ||
    typeof value.available !== "boolean" ||
    !(value.limit === null || nonnegative(value.limit)) ||
    !(value.remaining === null || nonnegative(value.remaining)) ||
    typeof value.resetAt !== "string" ||
    !Number.isFinite(Date.parse(value.resetAt)) ||
    typeof value.gateRequired !== "boolean" ||
    typeof value.plan !== "string" ||
    !Array.isArray(value.projects)
  )
    return null;
  const projects = value.projects.filter(
    (project): project is ToolStatus["projects"][number] =>
      isRecord(project) &&
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      typeof project.gscSiteUrl === "string",
  );
  if (projects.length !== value.projects.length) return null;
  return {
    available: value.available,
    limit: value.limit,
    remaining: value.remaining,
    resetAt: value.resetAt,
    gateRequired: value.gateRequired,
    plan: value.plan,
    projects,
  };
}
function messageFrom(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}
function resetTime(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function ToolboxWidget() {
  const root = useRef<HTMLElement>(null);
  const resultHeading = useRef<HTMLDivElement>(null);
  const activeRequest = useRef<AbortController | null>(null);
  const requestVersion = useRef(0);
  const [inline, setInline] = useState(false);
  const [selected, setSelected] = useState<Tool>(tools[0]);
  const [statuses, setStatuses] = useState<Partial<Record<Tool["id"], ToolStatus>>>({});
  const [statusesLoading, setStatusesLoading] = useState(true);
  const [statusErrors, setStatusErrors] = useState<string[]>([]);
  const [statusVersion, setStatusVersion] = useState(0);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Result>({ kind: "idle" });

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setInline(query.get("inline") === "1");
    if (query.get("owner") === "1") setSelected(tools[4]);
    return () => {
      requestVersion.current += 1;
      activeRequest.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!inline || !root.current || window.parent === window) return;
    const element = root.current;
    const reportHeight = () =>
      window.parent.postMessage(
        { type: "nv-seo-height", height: Math.ceil(element.getBoundingClientRect().height) },
        "*",
      );
    const observer = new ResizeObserver(reportHeight);
    observer.observe(element);
    reportHeight();
    return () => observer.disconnect();
  }, [inline]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && window.parent !== window)
        window.parent.postMessage("nv-seo-close", "*");
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    let active = true;
    setStatusesLoading(true);
    async function load() {
      const next: Partial<Record<Tool["id"], ToolStatus>> = {};
      const errors: string[] = [];
      // Establish the shared visitor cookie before requesting the next tool.
      for (const tool of tools) {
        try {
          const response = await fetch(`/api/tools/${tool.id}`, {
            credentials: "same-origin",
            cache: "no-store",
            signal: controller.signal,
          });
          const body: unknown = await response.json();
          const parsed = response.ok ? parseStatus(body) : null;
          if (!parsed) throw new Error("Status nicht verfügbar");
          next[tool.id] = parsed;
        } catch {
          errors.push(tool.label);
        }
      }
      if (active) {
        setStatuses((current) => ({ ...current, ...next }));
        setStatusErrors(errors);
        setStatusesLoading(false);
      }
      window.clearTimeout(timeout);
    }
    void load();
    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [statusVersion]);

  const visibleTools = tools.filter((tool) => statuses[tool.id]?.available);
  const status = statuses[selected.id];
  const busy = result.kind === "loading";
  const exhausted = status?.remaining === 0;
  const gated = status?.gateRequired === true;
  const noProjects = selected.field === "projectId" && status?.projects.length === 0;

  useEffect(() => {
    if (statusesLoading || visibleTools.some((tool) => tool.id === selected.id)) return;
    const first = visibleTools[0];
    if (first) {
      setSelected(first);
      setInput("");
      setResult({ kind: "idle" });
    }
  }, [statusesLoading, selected, statuses]);

  useEffect(() => {
    if (result.kind === "success" || result.kind === "error")
      resultHeading.current?.focus({ preventScroll: true });
  }, [result]);

  function select(tool: Tool) {
    if (tool.id === selected.id) return;
    requestVersion.current += 1;
    activeRequest.current?.abort();
    setSelected(tool);
    setInput("");
    setResult({ kind: "idle" });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      busy ||
      statusesLoading ||
      statusErrors.includes(selected.label) ||
      !status?.available ||
      exhausted ||
      gated ||
      noProjects
    )
      return;
    if (!input.trim()) {
      setResult({ kind: "error", message: "Bitte fülle das Eingabefeld aus.", action: "retry" });
      return;
    }
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const version = ++requestVersion.current;
    const tool = selected;
    const timeout = window.setTimeout(() => controller.abort(), 180_000);
    setResult({ kind: "loading" });
    try {
      const response = await fetch(`/api/tools/${tool.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ [tool.field]: input.trim() }),
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => {
        throw new Error("Die Antwort konnte nicht gelesen werden. Bitte versuche es erneut.");
      });
      if (version !== requestVersion.current) return;
      if (!response.ok) {
        const action =
          response.status === 401
            ? "login"
            : response.status === 429
              ? "wait"
              : isRecord(body) && body.code === "plan_unavailable"
                ? "plans"
                : "retry";
        setResult({
          kind: "error",
          message: messageFrom(
            body,
            response.status === 429
              ? "Das Stundenlimit ist erreicht. Bitte warte bis zur nächsten Freigabe."
              : "Die Prüfung ist derzeit nicht verfügbar. Bitte versuche es erneut.",
          ),
          action,
        });
        return;
      }
      const parsed = parseToolResult(tool.id, isRecord(body) ? body.data : undefined);
      setResult({ kind: "success", data: parsed });
    } catch (error) {
      if (version !== requestVersion.current) return;
      setResult({
        kind: "error",
        message: controller.signal.aborted
          ? "Die Prüfung dauert zu lange. Bitte versuche es später erneut."
          : error instanceof TypeError
            ? "Die Verbindung ist unterbrochen. Prüfe deine Internetverbindung und versuche es erneut."
            : error instanceof Error
              ? error.message
              : "Die Prüfung ist derzeit nicht erreichbar.",
        action: "retry",
      });
    } finally {
      window.clearTimeout(timeout);
      if (version === requestVersion.current) setStatusVersion((current) => current + 1);
      if (activeRequest.current === controller) activeRequest.current = null;
    }
  }

  return (
    <main ref={root} className={`nv-toolbox${inline ? " nv-toolbox--inline" : ""}`}>
      <header className="nv-toolbox__header">
        <p className="nv-toolbox__eyebrow">NUROVELLE SEO-TOOLBOX</p>
        <h1>Kostenloser SEO-Check</h1>
      </header>
      {statusesLoading && visibleTools.length === 0 ? (
        <p className="nv-toolbox__notice" role="status">
          Verfügbare Tools werden geladen …
        </p>
      ) : null}
      {statusErrors.length > 0 ? (
        <div className="nv-toolbox__notice" role="alert">
          <p>Der Status für {statusErrors.join(", ")} konnte nicht geladen werden.</p>
          <button
            className="nv-toolbox__secondary"
            type="button"
            disabled={statusesLoading}
            onClick={() => setStatusVersion((current) => current + 1)}
          >
            {statusesLoading ? "Wird geladen …" : "Status erneut laden"}
          </button>
        </div>
      ) : null}
      {visibleTools.length > 0 ? (
        <>
          <div className="nv-toolbox__tabs" role="tablist" aria-label="SEO-Tools">
            {visibleTools.map((tool) => (
              <button
                key={tool.id}
                id={`tab-${tool.id}`}
                type="button"
                role="tab"
                aria-selected={selected.id === tool.id}
                aria-controls="nv-toolbox-panel"
                tabIndex={selected.id === tool.id ? 0 : -1}
                onClick={() => select(tool)}
                onKeyDown={(event) => {
                  if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
                  event.preventDefault();
                  const index = visibleTools.findIndex((item) => item.id === selected.id);
                  const next =
                    event.key === "Home"
                      ? visibleTools[0]
                      : event.key === "End"
                        ? visibleTools[visibleTools.length - 1]
                        : visibleTools[
                            (index + (event.key === "ArrowRight" ? 1 : visibleTools.length - 1)) %
                              visibleTools.length
                          ];
                  if (next) {
                    select(next);
                    document.getElementById(`tab-${next.id}`)?.focus();
                  }
                }}
              >
                {tool.label}
              </button>
            ))}
          </div>
          <section
            id="nv-toolbox-panel"
            role="tabpanel"
            aria-labelledby={`tab-${selected.id}`}
            className="nv-toolbox__panel"
          >
            <p id="nv-toolbox-hint" className="nv-toolbox__hint">
              {selected.hint}
            </p>
            {status?.available ? (
              <>
                <p className="nv-toolbox__limit" role="status">
                  {statusesLoading
                    ? "Verfügbarkeit wird aktualisiert …"
                    : status.limit === null
                      ? "Ohne Stundenlimit"
                      : exhausted
                        ? `Stundenlimit erreicht. Neue Nutzungen ab ${resetTime(status.resetAt)}.`
                        : `${status.remaining} von ${status.limit} Prüfungen in dieser Stunde verfügbar.`}
                </p>
                {exhausted ? (
                  <button
                    className="nv-toolbox__secondary"
                    type="button"
                    disabled={statusesLoading}
                    onClick={() => setStatusVersion((current) => current + 1)}
                  >
                    Verfügbarkeit aktualisieren
                  </button>
                ) : null}
                {gated ? (
                  <div className="nv-toolbox__notice">
                    <p>
                      Deine kostenlose Vorschau ist abgeschlossen. Melde dich an oder lege ein Konto
                      an, um die Tools weiter zu nutzen.
                    </p>
                    <a href={LOGIN_URL} target="_top">
                      Anmelden oder Konto anlegen
                    </a>
                  </div>
                ) : noProjects ? (
                  <div className="nv-toolbox__notice">
                    <p>In diesem Workspace ist noch kein Search-Console-Projekt verbunden.</p>
                    <a href="/" target="_top">
                      Zu deinen Projekten
                    </a>
                  </div>
                ) : (
                  <form onSubmit={submit} className="nv-toolbox__form" aria-busy={busy}>
                    <label htmlFor="nv-toolbox-input">
                      {selected.field === "seed"
                        ? "Suchbegriff"
                        : selected.field === "projectId"
                          ? "GSC-Projekt"
                          : "Website-URL"}
                    </label>
                    <div className="nv-toolbox__input-row">
                      {selected.field === "projectId" ? (
                        <select
                          id="nv-toolbox-input"
                          value={input}
                          onChange={(event) => {
                            setInput(event.target.value);
                            setResult({ kind: "idle" });
                          }}
                          required
                          disabled={busy}
                          aria-describedby="nv-toolbox-hint"
                        >
                          <option value="">Projekt auswählen</option>
                          {status.projects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="nv-toolbox-input"
                          value={input}
                          onChange={(event) => {
                            setInput(event.target.value);
                            if (result.kind !== "idle") setResult({ kind: "idle" });
                          }}
                          type={selected.field === "url" ? "url" : "text"}
                          maxLength={selected.field === "seed" ? 120 : 2048}
                          placeholder={selected.placeholder}
                          required
                          disabled={busy}
                          autoComplete="off"
                          spellCheck={false}
                          aria-describedby="nv-toolbox-hint"
                        />
                      )}
                      <button
                        type="submit"
                        disabled={
                          busy ||
                          exhausted ||
                          statusesLoading ||
                          statusErrors.includes(selected.label)
                        }
                      >
                        {busy ? "Prüfung läuft …" : "Jetzt prüfen"}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : null}
            {busy ? (
              <div className="nv-toolbox__notice" role="status">
                <p>Deine Angaben werden geprüft. Bitte lasse das Widget geöffnet.</p>
              </div>
            ) : null}
            {result.kind === "error" ? (
              <div
                ref={resultHeading}
                tabIndex={-1}
                className="nv-toolbox__notice nv-toolbox__message"
                role="alert"
              >
                <p>{result.message}</p>
                {result.action === "login" && !gated ? (
                  <a href={LOGIN_URL} target="_top">
                    Anmelden oder Konto anlegen
                  </a>
                ) : result.action === "plans" ? (
                  <a href="/preise" target="_top">
                    Pläne ansehen
                  </a>
                ) : result.action === "retry" ? (
                  <p className="nv-toolbox__muted">
                    Deine Eingabe bleibt erhalten. Du kannst die Prüfung erneut starten.
                  </p>
                ) : null}
              </div>
            ) : null}
            {result.kind === "success" ? (
              <>
                <p className="nv-toolbox__completion" role="status">
                  Prüfung abgeschlossen. Dein Ergebnis steht unten.
                </p>
                <div
                  ref={resultHeading}
                  tabIndex={0}
                  className="nv-toolbox__result"
                  role="region"
                  aria-label="Prüfergebnis, scrollbar"
                >
                  <ToolResults result={result.data} />
                </div>
              </>
            ) : null}
          </section>
        </>
      ) : !statusesLoading && statusErrors.length === 0 ? (
        <p className="nv-toolbox__notice">
          In deinem aktuellen Tarif ist kein Tool verfügbar.{" "}
          <a href="/preise" target="_top">
            Pläne ansehen
          </a>
        </p>
      ) : null}
      <footer className="nv-toolbox__footer">
        <a href="/preise" target="_top">
          Pläne ansehen
        </a>
        <a href="/api/auth/google/start?return=homepage" target="_top">
          Owner-Login
        </a>
      </footer>
    </main>
  );
}

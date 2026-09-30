"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SerperForm({
  connected,
  source,
  status = null,
}: {
  connected: boolean;
  source: string | null;
  status?: string | null;
}) {
  const router = useRouter();
  const [apiKey, setApiKey] = useState("");
  const [error, setError] = useState("");
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/integrations/serper", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Fehler");
      return;
    }
    setApiKey("");
    router.refresh();
  }
  return (
    <form onSubmit={save} style={{ display: "grid", gap: 8, marginBottom: 24 }}>
      <p>
        Serper: {connected ? `verbunden (${source}${status ? `, ${status}` : ""})` : "nicht verbunden"}
        {status === "needs_reauth" ? " — Key ungültig, neu speichern." : ""}
        {" "}
        — Ranks, Brief, Fallback-Ideen.
      </p>
      <input
        value={apiKey}
        onChange={(e) => setApiKey(e.target.value)}
        placeholder="Serper API Key"
        type="password"
      />
      <p>
        <button type="submit">Key speichern</button>
        {connected && source === "workspace" ? (
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/integrations/serper", { method: "DELETE" });
              router.refresh();
            }}
          >
            Entfernen
          </button>
        ) : null}
      </p>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </form>
  );
}

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/team/invite", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setEmail("");
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", gap: 8, margin: "12px 0 24px" }}>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nina@agentur.de" />
      <button type="submit">Einladen</button>
    </form>
  );
}

export function BillingForm({ current }: { current: string }) {
  const [error, setError] = useState("");
  async function checkout(plan: "pro" | "agency") {
    setError("");
    const res = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Checkout fehlgeschlagen");
      return;
    }
    window.location.href = data.url;
  }
  async function portal() {
    setError("");
    const res = await fetch("/api/billing/portal", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Portal fehlgeschlagen");
      return;
    }
    window.location.href = data.url;
  }
  return (
    <div>
      <p>Aktiv: {current}</p>
      <p>
        <button type="button" onClick={() => checkout("pro")}>
          Pro abonnieren
        </button>{" "}
        <button type="button" onClick={() => checkout("agency")}>
          Agency abonnieren
        </button>{" "}
        <button type="button" onClick={portal}>
          Abo verwalten
        </button>
      </p>
      {error ? <p style={{ color: "#b42318" }}>{error}</p> : null}
    </div>
  );
}

export function WorkspaceSwitch({
  currentId,
  workspaces,
}: {
  currentId: string;
  workspaces: Array<{ id: string; name: string; plan: string }>;
}) {
  const router = useRouter();
  if (workspaces.length < 2) return null;
  return (
    <p>
      Workspace{" "}
      <select
        defaultValue={currentId}
        onChange={async (e) => {
          await fetch("/api/auth/workspace", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ workspaceId: e.target.value }),
          });
          window.location.href = "/";
        }}
      >
        {workspaces.map((ws) => (
          <option key={ws.id} value={ws.id}>
            {ws.name} ({ws.plan})
          </option>
        ))}
      </select>
    </p>
  );
}

export function LogoutButton() {
  return (
    <p>
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          window.location.href = "/login";
        }}
      >
        Logout
      </button>{" "}
      <button
        type="button"
        onClick={async () => {
          await fetch("/api/auth/sessions?all=1", { method: "DELETE" });
          window.location.href = "/login";
        }}
      >
        Alle Geräte abmelden
      </button>
    </p>
  );
}

export function SessionList({
  currentId,
  sessions,
}: {
  currentId: string;
  sessions: Array<{ id: string; lastSeenAt: Date; createdAt: Date }>;
}) {
  const router = useRouter();
  return (
    <ul>
      {sessions.map((s) => (
        <li key={s.id}>
          {s.id === currentId ? "Dieses Gerät" : "Anderes Gerät"} · zuletzt{" "}
          {s.lastSeenAt.toLocaleString("de-DE")}
          {s.id !== currentId ? (
            <>
              {" "}
              <button
                type="button"
                onClick={async () => {
                  await fetch(`/api/auth/sessions?id=${s.id}`, { method: "DELETE" });
                  router.refresh();
                }}
              >
                Beenden
              </button>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

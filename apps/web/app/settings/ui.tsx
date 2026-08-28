"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
  const router = useRouter();
  async function setPlan(plan: string) {
    await fetch("/api/billing/plan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    });
    router.refresh();
  }
  return (
    <p>
      Aktiv: {current}
      {" · "}
      <button type="button" onClick={() => setPlan("free")}>
        Free
      </button>
      <button type="button" onClick={() => setPlan("pro")}>
        Pro
      </button>
      <button type="button" onClick={() => setPlan("agency")}>
        Agency
      </button>
    </p>
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

"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Command = { id: string; title: string; keywords: string[]; href: string };

export function CommandPalette({
  projectId,
  commands,
}: {
  projectId: string;
  commands: Command[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter((c) =>
      [c.title, c.id, ...c.keywords].join(" ").toLowerCase().includes(needle),
    );
  }, [commands, q]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.35)",
        zIndex: 50,
        display: "flex",
        justifyContent: "center",
        paddingTop: 80,
      }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{
          width: 480,
          background: "#fff",
          borderRadius: 8,
          padding: 12,
          maxHeight: 420,
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Befehl oder Seite…"
          style={{ width: "100%", padding: 8 }}
        />
        <ul style={{ listStyle: "none", padding: 0, margin: "8px 0 0" }}>
          {hits.length === 0 ? <li>Nichts gefunden</li> : null}
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                style={{ width: "100%", textAlign: "left", padding: "8px 4px" }}
                onClick={() => {
                  setOpen(false);
                  router.push(`/p/${projectId}${c.href}`);
                }}
              >
                {c.title}
              </button>
            </li>
          ))}
        </ul>
        <p style={{ fontSize: 12, color: "#666" }}>⌘K / Ctrl+K</p>
      </div>
    </div>
  );
}

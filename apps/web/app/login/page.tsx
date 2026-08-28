"use client";

import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Fehler");
      return;
    }
    const next = new URLSearchParams(window.location.search).get("next");
    window.location.href = next && next.startsWith("/") ? next : "/";
  }

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>{mode === "login" ? "Anmelden" : "Konto anlegen"}</h1>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 8 }}>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-Mail" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Passwort"
        />
        <button type="submit">{mode === "login" ? "Login" : "Registrieren"}</button>
      </form>
      {error ? <p style={{ color: "crimson" }}>{error}</p> : null}
      <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
        {mode === "login" ? "Neues Konto" : "Ich habe schon ein Konto"}
      </button>
    </main>
  );
}

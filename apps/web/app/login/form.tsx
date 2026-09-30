"use client";

import { useState } from "react";

export function LoginForm({ error, next }: { error: string | null; next: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const action = mode === "login" ? "/api/auth/login" : "/api/auth/register";

  return (
    <main style={{ maxWidth: 420, margin: "80px auto", padding: 24 }}>
      <h1>{mode === "login" ? "Anmelden" : "Konto anlegen"}</h1>
      <form action={action} method="post" style={{ display: "grid", gap: 8 }}>
        <input type="hidden" name="next" value={next.startsWith("/") ? next : "/"} />
        <input name="email" placeholder="E-Mail" type="email" autoComplete="email" required />
        <input
          type="password"
          name="password"
          placeholder={mode === "register" ? "Passwort (min. 8 Zeichen)" : "Passwort"}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          minLength={mode === "register" ? 8 : undefined}
          required
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

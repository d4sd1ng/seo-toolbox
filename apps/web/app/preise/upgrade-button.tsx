"use client";

import { useState, type ReactNode } from "react";
import styles from "./preise.module.css";

export function UpgradeButton({ plan, children }: { plan: "pro" | "agency"; children: ReactNode }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, returnTo: "/preise" }),
      });
      if (response.status === 401) {
        window.location.href = "/login?next=%2Fpreise";
        return;
      }
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "Checkout fehlgeschlagen");
      window.location.href = data.url;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout fehlgeschlagen");
      setPending(false);
    }
  }

  return (
    <div>
      <button className={styles.button} type="button" onClick={checkout} disabled={pending}>
        {pending ? "Weiterleitung …" : children}
      </button>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
    </div>
  );
}

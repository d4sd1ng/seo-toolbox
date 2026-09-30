import type { Metadata } from "next";
import { TOOL_HOURLY_LIMITS } from "@/lib/rate-limit";
import { UpgradeButton } from "./upgrade-button";
import styles from "./preise.module.css";

export const metadata: Metadata = {
  title: "Pläne und Limits | Nurovelle SEO Toolbox",
  description: "Die verfügbaren Tools und Stundenlimits der Nurovelle SEO Toolbox im Überblick.",
};

const tools = [
  { label: "SEO-Audit", key: "onpage_audit" },
  { label: "Keyword-Check", key: "keyword_check" },
  { label: "Robots & Sitemap", key: "robots_sitemap" },
  { label: "Crawl-Demo", key: "crawl_demo" },
  { label: "GSC-Vorschau", key: "gsc_preview" },
] as const;

type BillingState = "success" | "cancel";

export default async function PreisePage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const state: BillingState | null = billing === "success" || billing === "cancel" ? billing : null;

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>Nurovelle SEO Toolbox</p>
          <h1>Pläne und Limits</h1>
          <p>Wähle den Umfang, der zu deinem Workspace passt.</p>
        </header>

        {state === "success" ? (
          <p className={styles.notice} role="status">
            Checkout abgeschlossen. Dein Plan wird aktiviert, sobald Stripe die Zahlung bestätigt hat.
          </p>
        ) : null}
        {state === "cancel" ? (
          <p className={styles.notice} role="status">Checkout abgebrochen. Dein Plan wurde nicht geändert.</p>
        ) : null}

        <section className={styles.cards} aria-label="Tarife">
          <article className={styles.card}>
            <h2>Free</h2>
            <p>Für erste Prüfungen.</p>
            <a className={styles.actionMuted} href="/login?next=%2Fpreise">Kostenlos starten</a>
          </article>
          <article className={`${styles.card} ${styles.featured}`}>
            <h2>Pro</h2>
            <p>Mehr Prüfungen und Keyword-Checks pro Stunde.</p>
            <UpgradeButton plan="pro">Jetzt upgraden</UpgradeButton>
          </article>
          <article className={styles.card}>
            <h2>Agency</h2>
            <p>Höhere Limits für mehrere Projekte.</p>
            <UpgradeButton plan="agency">Agency abonnieren</UpgradeButton>
          </article>
        </section>

        <section className={styles.comparison} aria-labelledby="comparison-heading">
          <h2 id="comparison-heading">Tool-Limits pro Stunde</h2>
          <div className={styles.tableScroll}>
            <table>
              <thead>
                <tr><th scope="col">Tool</th><th scope="col">Free</th><th scope="col">Pro</th><th scope="col">Agency</th><th scope="col">Owner</th></tr>
              </thead>
              <tbody>
                {tools.map(({ label, key }) => (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td>{formatLimit(TOOL_HOURLY_LIMITS[key].free)}</td>
                    <td>{formatLimit(TOOL_HOURLY_LIMITS[key].pro)}</td>
                    <td>{formatLimit(TOOL_HOURLY_LIMITS[key].agency)}</td>
                    <td>Ohne Stundenlimit</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.note}>Owner bezeichnet eine separat freigeschaltete Plattformrolle. Ein Workspace-Abo vergibt diese Rolle nicht.</p>
        </section>

        <section className={styles.faq} aria-labelledby="faq-heading">
          <h2 id="faq-heading">Häufige Fragen</h2>
          <details>
            <summary>Wie wird mein Plan aktiviert?</summary>
            <p>Nach dem Checkout bestätigt Stripe das Abo per Webhook. Dann wird der Plan deines Workspaces aktualisiert.</p>
          </details>
          <details>
            <summary>Wie verwalte ich mein Abo?</summary>
            <p>Im Bereich <a href="/settings">Team &amp; Billing</a> öffnest du das Stripe-Kundenportal.</p>
          </details>
          <details>
            <summary>Was bedeutet Owner?</summary>
            <p>Der Plattform-Owner wird über eine gesonderte E-Mail-Freigabe eingerichtet. Diese Berechtigung ist nicht Bestandteil eines Tarifs.</p>
          </details>
        </section>

        <footer className={styles.footer}>
          <a href="https://nurovelle.de/homepage/detail_seo.html">Zurück zu SEO-Systeme</a>
        </footer>
      </div>
    </main>
  );
}

function formatLimit(limit: number) {
  return limit === 0 ? "—" : limit.toLocaleString("de-DE");
}

import React, { type ReactNode } from "react";

export type ToolId = "audit" | "keyword-check" | "robots-sitemap" | "crawl-demo" | "gsc-preview";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function record(value: unknown) {
  if (!isRecord(value))
    throw new Error("Das Ergebnis konnte nicht gelesen werden. Bitte erneut prüfen.");
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string")
    throw new Error("Im Ergebnis fehlen Textangaben. Bitte erneut prüfen.");
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0)
    throw new Error("Im Ergebnis fehlen gültige Messwerte. Bitte erneut prüfen.");
  return value;
}
function nullableText(value: unknown) {
  return value === null ? null : text(value);
}
function score(value: unknown) {
  const result = number(value);
  if (result > 100) throw new Error("Der SEO-Wert konnte nicht gelesen werden.");
  return result;
}
function boolean(value: unknown): boolean {
  if (typeof value !== "boolean")
    throw new Error("Das Prüfergebnis ist unvollständig. Bitte erneut prüfen.");
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new Error("Die Ergebnisliste konnte nicht gelesen werden. Bitte erneut prüfen.");
  return value;
}
function severity(value: unknown): keyof typeof SEVERITIES {
  if (
    value === "critical" ||
    value === "high" ||
    value === "medium" ||
    value === "low" ||
    value === "info"
  )
    return value;
  throw new Error("Die Priorität konnte nicht gelesen werden.");
}

export function parseToolResult(tool: ToolId, value: unknown) {
  const data = record(value);
  switch (tool) {
    case "audit": {
      const metrics = record(data.metrics);
      return {
        kind: "audit" as const,
        url: text(data.url),
        status: number(data.status),
        score: score(data.score),
        indexable: boolean(data.indexable),
        metrics: {
          title: nullableText(metrics.title),
          metaDescription: nullableText(metrics.metaDescription),
          h1: nullableText(metrics.h1),
          h1Count: number(metrics.h1Count),
          wordCount: number(metrics.wordCount),
          images: number(metrics.images),
          imagesMissingAlt: number(metrics.imagesMissingAlt),
          canonicalUrl: nullableText(metrics.canonicalUrl),
        },
        findings: list(data.findings).map((item) => {
          const finding = record(item);
          return {
            title: text(finding.title),
            description: text(finding.description),
            recommendation: text(finding.recommendation),
            severity: severity(finding.severity),
          };
        }),
      };
    }
    case "keyword-check":
      return {
        kind: "keyword-check" as const,
        seed: text(data.seed),
        provider: text(data.provider),
        suggestions: list(data.suggestions).map(text),
      };
    case "robots-sitemap": {
      const robots = record(data.robots);
      const sitemap = record(data.sitemap);
      return {
        kind: "robots-sitemap" as const,
        origin: text(data.origin),
        robots: {
          url: text(robots.url),
          status: number(robots.status),
          found: boolean(robots.found),
          sitemaps: list(robots.sitemaps).map(text),
        },
        sitemap: {
          url: text(sitemap.url),
          status: number(sitemap.status),
          found: boolean(sitemap.found),
          urls: number(sitemap.urls),
        },
      };
    }
    case "crawl-demo":
      return {
        kind: "crawl-demo" as const,
        seedUrl: text(data.seedUrl),
        crawled: number(data.crawled),
        maxPages: number(data.maxPages),
        pages: list(data.pages).map((item) => {
          const page = record(item);
          return {
            url: text(page.url),
            status: number(page.status),
            score: page.score === null ? null : score(page.score),
            title: nullableText(page.title),
            h1: nullableText(page.h1),
          };
        }),
      };
    case "gsc-preview":
      return {
        kind: "gsc-preview" as const,
        siteUrl: text(data.siteUrl),
        rows: list(data.rows).map((item) => {
          const row = record(item);
          return {
            keys: list(row.keys).map(text),
            clicks: number(row.clicks),
            impressions: number(row.impressions),
            ctr: number(row.ctr),
            position: number(row.position),
          };
        }),
      };
  }
}
export type ToolResult = ReturnType<typeof parseToolResult>;

const SEVERITIES = {
  critical: "Kritisch",
  high: "Hohe Priorität",
  medium: "Mittlere Priorität",
  low: "Niedrige Priorität",
  info: "Hinweis",
};
const PRIORITY = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
const decimal = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="nv-toolbox__metric">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function PageAddress({ value }: { value: string }) {
  return <p className="nv-toolbox__address">{value}</p>;
}
function HttpStatus({ status }: { status: number }) {
  return <span>{status === 0 ? "Abruf fehlgeschlagen" : `HTTP ${status}`}</span>;
}
function Score({ value }: { value: number }) {
  return (
    <div className="nv-toolbox__score">
      <strong>{value}</strong>
      <span>von 100 Punkten</span>
    </div>
  );
}

export function ToolResults({ result }: { result: ToolResult }) {
  switch (result.kind) {
    case "audit": {
      const findings = [...result.findings].sort(
        (a, b) => PRIORITY[a.severity] - PRIORITY[b.severity],
      );
      return (
        <>
          <h2>Dein SEO-Ergebnis</h2>
          <PageAddress value={result.url} />
          <div className="nv-toolbox__summary">
            <Score value={result.score} />
            <div>
              <h3>
                {findings.length === 0
                  ? "Keine Auffälligkeiten in diesen Prüfungen"
                  : `${findings.length} ${findings.length === 1 ? "Verbesserung gefunden" : "Verbesserungen gefunden"}`}
              </h3>
              <p>
                Der Wert fasst die automatischen HTML-Prüfungen zusammen. Er ist keine Bewertung
                deiner Google-Platzierung.
              </p>
              <p>
                <HttpStatus status={result.status} /> ·{" "}
                {result.indexable
                  ? "Kein noindex-Meta-Tag erkannt"
                  : "Hinweis zur Indexierbarkeit gefunden"}
              </p>
            </div>
          </div>
          <dl className="nv-toolbox__metrics">
            <Metric label="Wörter im HTML">{result.metrics.wordCount}</Metric>
            <Metric label="H1-Überschriften">{result.metrics.h1Count}</Metric>
            <Metric label="Bilder ohne Alt-Text">
              {result.metrics.imagesMissingAlt} von {result.metrics.images}
            </Metric>
          </dl>
          {findings.length > 0 ? (
            <>
              <h3>Das kannst du verbessern</h3>
              <ol className="nv-toolbox__findings">
                {findings.map((finding, index) => (
                  <li key={`${finding.title}-${index}`}>
                    <span className={`nv-toolbox__badge nv-toolbox__badge--${finding.severity}`}>
                      {SEVERITIES[finding.severity]}
                    </span>
                    <h4>{finding.title}</h4>
                    <p>{finding.description}</p>
                    <p>
                      <strong>Nächster Schritt:</strong> {finding.recommendation}
                    </p>
                  </li>
                ))}
              </ol>
            </>
          ) : (
            <p>
              In den geprüften Bereichen wurden keine Probleme erkannt. Weitere SEO-Aspekte können
              trotzdem relevant sein.
            </p>
          )}
          <details className="nv-toolbox__details">
            <summary>Gefundene Seitenangaben</summary>
            <dl className="nv-toolbox__facts">
              <Metric label="Seitentitel">{result.metrics.title || "Nicht gefunden"}</Metric>
              <Metric label="Meta-Beschreibung">
                {result.metrics.metaDescription || "Nicht gefunden"}
              </Metric>
              <Metric label="Erste H1">{result.metrics.h1 || "Nicht gefunden"}</Metric>
              <Metric label="Canonical-URL">
                {result.metrics.canonicalUrl || "Nicht gefunden"}
              </Metric>
            </dl>
          </details>
        </>
      );
    }
    case "keyword-check":
      return (
        <>
          <h2>Keyword-Ideen</h2>
          <PageAddress value={result.seed} />
          <p>
            Begriffe zur weiteren Recherche. Die Liste enthält keine Messwerte zu Suchvolumen,
            Wettbewerb oder Rankings.
          </p>
          {result.suggestions.length ? (
            <ul className="nv-toolbox__keywords">
              {result.suggestions.map((suggestion, index) => (
                <li key={`${suggestion}-${index}`}>{suggestion}</li>
              ))}
            </ul>
          ) : (
            <p>
              Für diesen Suchbegriff wurden keine Vorschläge geliefert. Versuche einen allgemeineren
              Begriff.
            </p>
          )}
          <p className="nv-toolbox__muted">
            Datenquelle:{" "}
            {result.provider === "dataforseo"
              ? "DataForSEO"
              : result.provider === "serper"
                ? "Serper"
                : result.provider}
          </p>
        </>
      );
    case "robots-sitemap":
      return (
        <>
          <h2>Robots &amp; Sitemap</h2>
          <PageAddress value={result.origin} />
          <div className="nv-toolbox__checks">
            <article>
              <h3>robots.txt</h3>
              <p>
                <strong>
                  {result.robots.found ? "Erreichbar" : "Nicht mit HTTP 200 erreichbar"}
                </strong>{" "}
                · <HttpStatus status={result.robots.status} />
              </p>
              <PageAddress value={result.robots.url} />
              <p>
                {result.robots.found
                  ? "Die Datei wurde abgerufen. Ob ihre Regeln einzelne Seiten sperren, wird hier nicht ausgewertet."
                  : "Prüfe die Datei und den angezeigten HTTP-Status. Eine fehlende robots.txt bedeutet nicht automatisch eine Sperre."}
              </p>
            </article>
            <article>
              <h3>sitemap.xml</h3>
              <p>
                <strong>
                  {result.sitemap.found ? "Erreichbar" : "Nicht mit HTTP 200 erreichbar"}
                </strong>{" "}
                · <HttpStatus status={result.sitemap.status} />
              </p>
              <PageAddress value={result.sitemap.url} />
              <p>
                {result.sitemap.found
                  ? `${result.sitemap.urls} loc-Einträge gefunden. Diese können Seiten oder weitere Sitemaps bezeichnen.`
                  : "Geprüft wurde /sitemap.xml. Deine Sitemap kann unter einer anderen Adresse liegen."}
              </p>
            </article>
          </div>
          {result.robots.sitemaps.length > 0 ? (
            <>
              <h3>Sitemap-Adressen aus robots.txt</h3>
              <ul className="nv-toolbox__url-list">
                {result.robots.sitemaps.map((url, index) => (
                  <li key={`${url}-${index}`}>{url}</li>
                ))}
              </ul>
              <p className="nv-toolbox__muted">
                Diese Adressen wurden ausgelesen, aber nicht zusätzlich abgerufen.
              </p>
            </>
          ) : (
            <p className="nv-toolbox__muted">
              Keine Sitemap-Adresse in der abgerufenen robots.txt gefunden.
            </p>
          )}
        </>
      );
    case "crawl-demo":
      return (
        <>
          <h2>Deine Crawl-Vorschau</h2>
          <PageAddress value={result.seedUrl} />
          <p>
            {result.crawled} von maximal {result.maxPages} Seiten geprüft. Die Vorschau wertet das
            abgerufene HTML ohne JavaScript-Rendering aus.
          </p>
          {result.pages.length === 0 ? (
            <p>Es konnten keine Seiten geprüft werden.</p>
          ) : (
            <ul className="nv-toolbox__pages">
              {result.pages.map((page, index) => (
                <li key={`${page.url}-${index}`}>
                  <div className="nv-toolbox__page-heading">
                    <h3>{page.title || "Kein Seitentitel verfügbar"}</h3>
                    <span className="nv-toolbox__badge">
                      {page.score === null ? "Kein SEO-Wert" : `${page.score}/100 Punkte`}
                    </span>
                  </div>
                  <PageAddress value={page.url} />
                  <p>
                    <HttpStatus status={page.status} />
                    {page.status === 0 ? ". Die Seite konnte nicht abgerufen werden." : ""}
                  </p>
                  <p>H1: {page.h1 || "Nicht gefunden oder nicht auswertbar"}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      );
    case "gsc-preview":
      return (
        <>
          <h2>Search-Console-Vorschau</h2>
          <PageAddress value={result.siteUrl} />
          <p>
            Bis zu zehn Suchanfragen aus dem angefragten Zeitraum der letzten sieben Tage. Aktuelle
            Google-Daten können noch unvollständig sein.
          </p>
          {result.rows.length === 0 ? (
            <p>Für diesen Zeitraum wurden keine Suchanfragen geliefert.</p>
          ) : (
            <div
              className="nv-toolbox__table-scroll"
              role="region"
              aria-label="Suchanfragen, horizontal scrollbar"
              tabIndex={0}
            >
              <table>
                <caption>Suchanfragen und Messwerte</caption>
                <thead>
                  <tr>
                    <th scope="col">Suchanfrage</th>
                    <th scope="col">Klicks</th>
                    <th scope="col">Impressionen</th>
                    <th scope="col">Klickrate</th>
                    <th scope="col">Ø Position</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, index) => (
                    <tr key={index}>
                      <th scope="row">{row.keys.join(" · ") || "Ohne Suchanfrage"}</th>
                      <td>{decimal.format(row.clicks)}</td>
                      <td>{decimal.format(row.impressions)}</td>
                      <td>{decimal.format(row.ctr * 100)} %</td>
                      <td>{decimal.format(row.position)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      );
  }
}

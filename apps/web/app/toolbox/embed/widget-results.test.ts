import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { parseToolResult, ToolResults, type ToolId } from "./widget-results";

const audit = {
  url: "https://example.com/",
  status: 200,
  score: 66,
  indexable: true,
  metrics: {
    title: "Beispiel",
    metaDescription: null,
    h1: "Beispiel",
    h1Count: 1,
    wordCount: 240,
    images: 3,
    imagesMissingAlt: 1,
    canonicalUrl: null,
  },
  findings: [
    {
      title: "Bilder ohne Alt-Text",
      severity: "medium",
      description: "Ein Alt-Text fehlt.",
      recommendation: "Alt-Text ergänzen.",
    },
    {
      title: "Title fehlt",
      severity: "critical",
      description: "Kein Title-Tag.",
      recommendation: "Seitentitel setzen.",
    },
  ],
};
function render(tool: ToolId, data: unknown) {
  return renderToStaticMarkup(createElement(ToolResults, { result: parseToolResult(tool, data) }));
}

describe("Widget-Ergebnisse für Besucher", () => {
  it("zeigt Audit-Maßnahmen nach Priorität und erklärt die Grenze des Scores", () => {
    const html = render("audit", audit);
    expect(html.indexOf("<h4>Title fehlt</h4>")).toBeLessThan(
      html.indexOf("<h4>Bilder ohne Alt-Text</h4>"),
    );
    expect(html).toContain("Seitentitel setzen.");
    expect(html).toContain("keine Bewertung deiner Google-Platzierung");
    expect(html).toContain("Nicht gefunden");
    expect(html).not.toContain("<pre");
  });
  it("stellt fremde Seitentexte als Text dar", () => {
    const html = render("audit", {
      ...audit,
      metrics: { ...audit.metrics, title: '<script>alert("x")</script>' },
    });
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });
  it("unterscheidet fehlende Messwerte und eine erfolgreiche Prüfung ohne Befunde", () => {
    expect(render("audit", { ...audit, score: 100, findings: [] })).toContain(
      "Keine Auffälligkeiten in diesen Prüfungen",
    );
    expect(() => parseToolResult("audit", { ...audit, score: undefined })).toThrow();
    expect(() => parseToolResult("audit", { ...audit, score: 101 })).toThrow();
    expect(() => parseToolResult("audit", { ...audit, findings: [{}] })).toThrow();
  });
  it("erfindet bei Keyword-Ideen keine Suchvolumina", () => {
    const html = render("keyword-check", {
      seed: "SEO",
      provider: "serper",
      suggestions: ["SEO Beratung"],
    });
    expect(html).toContain("SEO Beratung");
    expect(html).toContain("keine Messwerte zu Suchvolumen");
    expect(render("keyword-check", { seed: "SEO", provider: "serper", suggestions: [] })).toContain(
      "keine Vorschläge geliefert",
    );
  });
  it("erklärt eine fehlende Standard-Sitemap und trennt gelesene von abgerufenen Adressen", () => {
    const html = render("robots-sitemap", {
      origin: "https://example.com",
      robots: {
        url: "https://example.com/robots.txt",
        found: true,
        status: 200,
        sitemaps: ["https://example.com/custom.xml"],
      },
      sitemap: { url: "https://example.com/sitemap.xml", found: false, status: 404, urls: 0 },
    });
    expect(html).toContain("HTTP 404");
    expect(html).toContain("unter einer anderen Adresse");
    expect(html).toContain("nicht zusätzlich abgerufen");
  });
  it("kennzeichnet einen fehlgeschlagenen Crawl-Abruf ohne erfundenen Score", () => {
    const html = render("crawl-demo", {
      seedUrl: "https://example.com",
      crawled: 1,
      maxPages: 3,
      pages: [{ url: "https://example.com", status: 0, score: null, title: null, h1: null }],
    });
    expect(html).toContain("Abruf fehlgeschlagen");
    expect(html).toContain("Kein SEO-Wert");
    expect(html).not.toContain("0/100");
  });
  it("formatiert GSC-Klickrate und Position verständlich und behandelt leere Daten", () => {
    const html = render("gsc-preview", {
      siteUrl: "sc-domain:example.com",
      rows: [{ keys: ["SEO"], clicks: 3, impressions: 100, ctr: 0.03, position: 4.5 }],
    });
    expect(html).toContain("3 %");
    expect(html).toContain("4,5");
    expect(html).toContain('scope="col"');
    expect(render("gsc-preview", { siteUrl: "sc-domain:example.com", rows: [] })).toContain(
      "keine Suchanfragen geliefert",
    );
  });
  it("weist unvollständige und werkzeugfremde Ergebnisse zurück", () => {
    expect(() => parseToolResult("crawl-demo", audit)).toThrow();
    expect(() =>
      parseToolResult("gsc-preview", { siteUrl: "x", rows: [{ clicks: "3" }] }),
    ).toThrow();
    expect(() =>
      parseToolResult("keyword-check", { seed: "x", provider: "serper", suggestions: [null] }),
    ).toThrow();
  });
});

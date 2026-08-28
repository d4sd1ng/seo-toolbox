import { definePlugin } from "plugin-sdk";

export const crawlerPlugin = definePlugin({
  id: "crawler",
  name: "Site Crawl",
  description: "Technischer HTML-Crawl: Statuscodes, Redirects, Duplicate Tags, Orphans.",
  version: "0.1.0",
  category: "technical",
  icon: "spider",
  nav: [
    {
      id: "crawler.audit",
      label: "Crawl",
      href: "/crawl",
      section: "technical",
      icon: "spider",
      order: 10,
    },
  ],
  widgets: [
    {
      id: "crawler.summary",
      slot: "overview.widgets",
      title: "Letzter Crawl",
      size: "m",
      order: 20,
    },
  ],
  commands: [
    {
      id: "crawler.run",
      title: "Site-Crawl starten",
      keywords: ["crawl", "audit", "404", "technik"],
      shortcut: "g c",
      requiresProject: true,
    },
  ],
  issueRules: [
    { type: "status_4xx", title: "4xx-URLs", defaultSeverity: "high", defaultEffort: "s" },
    { type: "status_5xx", title: "5xx-URLs", defaultSeverity: "critical", defaultEffort: "m" },
    { type: "redirect_chain", title: "Redirect-Ketten", defaultSeverity: "medium", defaultEffort: "s" },
    { type: "duplicate_title", title: "Doppelte Titles", defaultSeverity: "medium", defaultEffort: "s" },
    { type: "missing_title", title: "Titles fehlen", defaultSeverity: "high", defaultEffort: "s" },
    { type: "missing_h1", title: "H1 fehlt", defaultSeverity: "medium", defaultEffort: "s" },
    { type: "canonical_mismatch", title: "Canonical zeigt weg", defaultSeverity: "high", defaultEffort: "s" },
    { type: "orphan_pages", title: "Verwaiste Seiten", defaultSeverity: "medium", defaultEffort: "m" },
    { type: "js_dependent_content", title: "Inhalt erst nach JS", defaultSeverity: "medium", defaultEffort: "l" },
    { type: "render_budget_exhausted", title: "Render-Budget leer", defaultSeverity: "info", defaultEffort: "xs" },
  ],
  permissions: {
    jobs: ["site_crawl"],
    canWriteIssues: true,
    canWritePages: true,
  },
});

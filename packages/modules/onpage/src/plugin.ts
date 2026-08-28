import { definePlugin } from "plugin-sdk";

export const onPagePlugin = definePlugin({
  id: "onpage",
  name: "On-Page Audit",
  description: "Prüft eine URL auf Snippet, Indexability und Basis-Inhalt.",
  version: "0.1.0",
  category: "optimize",
  icon: "file-search",
  nav: [
    {
      id: "onpage.audit",
      label: "On-Page",
      href: "/onpage",
      section: "optimize",
      icon: "file-search",
      order: 10,
    },
  ],
  widgets: [
    {
      id: "onpage.recent",
      slot: "overview.widgets",
      title: "Letzte On-Page Audits",
      size: "s",
      order: 30,
    },
  ],
  commands: [
    {
      id: "onpage.run",
      title: "On-Page Audit starten",
      keywords: ["audit", "onpage", "title", "meta", "h1"],
      shortcut: "g o",
      requiresProject: true,
    },
  ],
  issueRules: [
    { type: "missing_title", title: "Title fehlt", defaultSeverity: "critical", defaultEffort: "xs" },
    { type: "title_too_short", title: "Title zu kurz", defaultSeverity: "medium", defaultEffort: "xs" },
    { type: "title_too_long", title: "Title zu lang", defaultSeverity: "medium", defaultEffort: "xs" },
    { type: "missing_meta_description", title: "Meta Description fehlt", defaultSeverity: "high", defaultEffort: "xs" },
    { type: "missing_h1", title: "H1 fehlt", defaultSeverity: "high", defaultEffort: "xs" },
    { type: "multiple_h1", title: "Mehrere H1", defaultSeverity: "low", defaultEffort: "s" },
    { type: "not_indexable", title: "Seite nicht indexierbar", defaultSeverity: "critical", defaultEffort: "s" },
    { type: "canonical_mismatch", title: "Canonical zeigt weg", defaultSeverity: "high", defaultEffort: "s" },
    { type: "images_missing_alt", title: "Bilder ohne Alt-Text", defaultSeverity: "medium", defaultEffort: "m" },
    { type: "thin_content", title: "Dünner Inhalt", defaultSeverity: "medium", defaultEffort: "l" },
  ],
  permissions: {
    jobs: ["onpage_audit"],
    canWriteIssues: true,
    canWritePages: true,
  },
});

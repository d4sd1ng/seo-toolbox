import { definePlugin } from "plugin-sdk";

export const gscPlugin = definePlugin({
  id: "gsc",
  name: "Search Console",
  description: "First-Party-Daten aus Google Search Console.",
  version: "0.1.0",
  category: "measure",
  icon: "line-chart",
  nav: [
    {
      id: "gsc.dashboard",
      label: "Search Console",
      href: "/gsc",
      section: "measure",
      icon: "line-chart",
      order: 10,
    },
    {
      id: "keywords.list",
      label: "Keywords",
      href: "/keywords",
      section: "acquire",
      icon: "search",
      order: 20,
    },
  ],
  widgets: [
    {
      id: "gsc.kpis",
      slot: "overview.widgets",
      title: "GSC 28 Tage",
      size: "m",
      order: 10,
    },
  ],
  commands: [
    {
      id: "gsc.sync",
      title: "Search Console synchronisieren",
      keywords: ["gsc", "search console", "sync", "clicks"],
      shortcut: "g s",
      requiresProject: true,
    },
  ],
  issueRules: [
    {
      type: "ctr_opportunity",
      title: "CTR-Chance",
      defaultSeverity: "high",
      defaultEffort: "s",
    },
    {
      type: "high_impressions_poor_position",
      title: "Viel Sichtbarkeit, schwache Position",
      defaultSeverity: "medium",
      defaultEffort: "m",
    },
  ],
  permissions: {
    integrations: ["gsc"],
    jobs: ["gsc_sync"],
    canWriteIssues: true,
    canWriteKeywords: true,
  },
});

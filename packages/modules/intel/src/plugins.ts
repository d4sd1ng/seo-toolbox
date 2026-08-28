import { definePlugin } from "plugin-sdk";

export const researchPlugin = definePlugin({
  id: "research",
  name: "Keyword Research",
  description: "Volume und Ideen über DataForSEO.",
  version: "0.1.0",
  category: "acquire",
  icon: "search",
  nav: [{ id: "research.ui", label: "Recherche", href: "/research", section: "acquire", icon: "search", order: 15 }],
  widgets: [],
  commands: [{ id: "research.run", title: "Keywords recherchieren", keywords: ["keyword", "volume"], requiresProject: true }],
  issueRules: [],
  permissions: { jobs: ["keyword_expand"], canWriteKeywords: true },
});

export const ranksPlugin = definePlugin({
  id: "ranks",
  name: "Rank Tracker",
  description: "Positionen über SERP-API.",
  version: "0.1.0",
  category: "acquire",
  icon: "trending-up",
  nav: [{ id: "ranks.ui", label: "Rankings", href: "/ranks", section: "acquire", icon: "trending-up", order: 25 }],
  widgets: [],
  commands: [{ id: "ranks.run", title: "Rankings prüfen", keywords: ["rank", "position"], requiresProject: true }],
  issueRules: [{ type: "rank_drop", title: "Ranking-Verlust", defaultSeverity: "high", defaultEffort: "m" }],
  permissions: { jobs: ["rank_check"], canWriteIssues: true },
});

export const briefPlugin = definePlugin({
  id: "brief",
  name: "Content Brief",
  description: "Brief aus der aktuellen SERP.",
  version: "0.1.0",
  category: "optimize",
  icon: "file-text",
  nav: [{ id: "brief.ui", label: "Brief", href: "/brief", section: "optimize", icon: "file-text", order: 20 }],
  widgets: [],
  commands: [{ id: "brief.run", title: "Content-Brief erzeugen", keywords: ["brief", "content"], requiresProject: true }],
  issueRules: [],
  permissions: { jobs: ["serp_snapshot"], canWriteKeywords: true },
});

export const backlinksPlugin = definePlugin({
  id: "backlinks",
  name: "Backlinks",
  description: "Domain-Überblick über DataForSEO.",
  version: "0.1.0",
  category: "measure",
  icon: "link",
  nav: [{ id: "backlinks.ui", label: "Backlinks", href: "/backlinks", section: "measure", icon: "link", order: 20 }],
  widgets: [],
  commands: [{ id: "backlinks.run", title: "Backlinks synchronisieren", keywords: ["links", "backlink"], requiresProject: true }],
  issueRules: [{ type: "broken_backlinks", title: "Kaputte Backlinks", defaultSeverity: "medium", defaultEffort: "m" }],
  permissions: { integrations: ["backlink_api"], jobs: ["backlink_sync"], canWriteIssues: true },
});

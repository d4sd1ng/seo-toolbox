import { definePlugin } from "plugin-sdk";

export const pageSpeedPlugin = definePlugin({
  id: "pagespeed",
  name: "PageSpeed",
  description: "Core Web Vitals über PageSpeed Insights.",
  version: "0.1.0",
  category: "technical",
  icon: "gauge",
  nav: [
    {
      id: "pagespeed.run",
      label: "PageSpeed",
      href: "/pagespeed",
      section: "technical",
      icon: "gauge",
      order: 20,
    },
  ],
  widgets: [],
  commands: [
    {
      id: "pagespeed.run",
      title: "PageSpeed prüfen",
      keywords: ["cwv", "lcp", "inp", "cls", "speed"],
      requiresProject: true,
    },
  ],
  issueRules: [
    { type: "poor_lcp", title: "LCP zu hoch", defaultSeverity: "high", defaultEffort: "m" },
    { type: "poor_inp", title: "INP zu hoch", defaultSeverity: "medium", defaultEffort: "m" },
    { type: "poor_cls", title: "CLS zu hoch", defaultSeverity: "medium", defaultEffort: "s" },
  ],
  permissions: {
    integrations: ["pagespeed"],
    jobs: ["pagespeed"],
    canWriteIssues: true,
  },
});

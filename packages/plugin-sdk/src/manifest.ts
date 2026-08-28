/**
 * Plugin SDK – each SEO tool is a module that registers against Core.
 * Core never imports a module directly; it reads manifests + hook handlers.
 */

import type {
  Effort,
  ID,
  Issue,
  Job,
  JobType,
  Project,
  Severity,
} from "core";

export type NavSection =
  | "overview"
  | "acquire"
  | "optimize"
  | "technical"
  | "measure"
  | "settings";

export type UiSlot =
  | "project.sidebar"
  | "project.header.actions"
  | "overview.widgets"
  | "page.drawer"
  | "command.palette"
  | "issue.actions";

export interface PluginPermission {
  integrations?: Array<"gsc" | "ga4" | "pagespeed" | "serp_api" | "backlink_api">;
  jobs?: JobType[];
  canWriteIssues?: boolean;
  canWriteKeywords?: boolean;
  canWritePages?: boolean;
}

export interface NavItem {
  id: string;
  label: string;
  href: string; // relative to /p/:projectId
  section: NavSection;
  icon: string;
  order: number;
  badge?: "issues" | "jobs" | "none";
}

export interface WidgetDefinition {
  id: string;
  slot: Extract<UiSlot, "overview.widgets">;
  title: string;
  size: "s" | "m" | "l";
  order: number;
}

export interface CommandDefinition {
  id: string;
  title: string;
  subtitle?: string;
  keywords: string[];
  shortcut?: string;
  requiresProject: boolean;
}

export interface IssueRule {
  type: string;
  title: string;
  defaultSeverity: Severity;
  defaultEffort: Effort;
  docsUrl?: string;
}

export interface PluginManifest {
  id: string;
  name: string;
  description: string;
  version: string;
  category: NavSection;
  icon: string;
  nav: NavItem[];
  widgets: WidgetDefinition[];
  commands: CommandDefinition[];
  issueRules: IssueRule[];
  permissions: PluginPermission;
}

export interface ProjectContext {
  project: Project;
  workspaceId: ID;
  integrations: string[];
}

export interface PluginHooks {
  onProjectCreated?(ctx: ProjectContext): Promise<void>;
  onCrawlFinished?(ctx: ProjectContext, crawlId: ID): Promise<IssueDraft[]>;
  onGscSynced?(ctx: ProjectContext): Promise<IssueDraft[]>;
  onJobFinished?(ctx: ProjectContext, job: Job): Promise<void>;
}

export interface IssueDraft {
  type: string;
  title: string;
  description: string;
  recommendation: string;
  severity: Severity;
  effort: Effort;
  priorityScore: number;
  entityType: Issue["entityType"];
  entityId: ID | null;
  url: string | null;
  evidence?: Record<string, unknown>;
}

export interface RegisteredPlugin {
  manifest: PluginManifest;
  hooks: PluginHooks;
}

export function definePlugin(
  manifest: PluginManifest,
  hooks: PluginHooks = {},
): RegisteredPlugin {
  return { manifest, hooks };
}

/** Example: On-Page Analyzer */
export const onPagePluginExample = definePlugin({
  id: "onpage",
  name: "On-Page Audit",
  description: "Analysiert eine URL auf Title, Meta, Headings, Indexability.",
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
      keywords: ["audit", "onpage", "title", "meta"],
      shortcut: "g o",
      requiresProject: true,
    },
  ],
  issueRules: [
    {
      type: "missing_title",
      title: "Title fehlt",
      defaultSeverity: "critical",
      defaultEffort: "xs",
    },
    {
      type: "title_too_long",
      title: "Title zu lang",
      defaultSeverity: "medium",
      defaultEffort: "xs",
    },
  ],
  permissions: {
    jobs: ["onpage_audit"],
    canWriteIssues: true,
    canWritePages: true,
  },
});

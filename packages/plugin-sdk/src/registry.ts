import type { NavItem, RegisteredPlugin } from "./manifest";

const plugins = new Map<string, RegisteredPlugin>();

export function registerPlugin(plugin: RegisteredPlugin) {
  plugins.set(plugin.manifest.id, plugin);
}

export function getPlugin(id: string) {
  return plugins.get(id);
}

export function listPlugins() {
  return [...plugins.values()];
}

export function navForProject(): NavItem[] {
  return listPlugins()
    .flatMap((p) => p.manifest.nav)
    .sort((a, b) => a.section.localeCompare(b.section) || a.order - b.order);
}

export function commandsForProject() {
  return listPlugins().flatMap((p) =>
    p.manifest.commands.map((c) => ({ ...c, moduleId: p.manifest.id })),
  );
}

export type RobotsRules = {
  allow: string[];
  disallow: string[];
};

export function parseRobotsTxt(text: string, userAgent = "SEOToolboxBot"): RobotsRules {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const groups: Array<{ agents: string[]; allow: string[]; disallow: string[] }> = [];
  let current: { agents: string[]; allow: string[]; disallow: string[] } | null = null;

  for (const line of lines) {
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || current.allow.length + current.disallow.length > 0) {
        current = { agents: [], allow: [], disallow: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      current.disallow.push(value);
    } else if (key === "allow" && current) {
      current.allow.push(value);
    }
  }

  const ua = userAgent.toLowerCase();
  const match =
    groups.find((g) => g.agents.includes(ua)) ??
    groups.find((g) => g.agents.includes("*")) ??
    { allow: [], disallow: [] };

  return { allow: match.allow, disallow: match.disallow };
}

export function isAllowed(pathname: string, rules: RobotsRules) {
  const matches = (pattern: string, path: string) => {
    if (!pattern) return false;
    if (pattern === "/") return true;
    return path.startsWith(pattern);
  };
  const allowedHit = rules.allow
    .filter((p) => matches(p, pathname))
    .sort((a, b) => b.length - a.length)[0];
  const deniedHit = rules.disallow
    .filter((p) => matches(p, pathname))
    .sort((a, b) => b.length - a.length)[0];
  if (allowedHit && (!deniedHit || allowedHit.length >= deniedHit.length)) return true;
  if (deniedHit) return false;
  return true;
}

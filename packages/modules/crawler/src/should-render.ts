const APP_SHELL = /id=["'](?:__next|__nuxt|app|root|___gatsby)["']/i;
const DEFAULT_TITLES = /^(next\.js|nuxt|react app|vite \+|untitled)?$/i;

export function shouldRender(input: {
  status: number;
  html: string;
  contentType: string;
  isSeed: boolean;
}): { render: boolean; reason: string } {
  if (input.status < 200 || input.status >= 300) {
    return { render: false, reason: "non_200" };
  }
  if (!input.contentType.includes("html") && input.html.length === 0) {
    return { render: false, reason: "non_html" };
  }
  if (input.isSeed) {
    return { render: true, reason: "seed" };
  }

  const text = input.html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const wordCount = text ? text.split(" ").length : 0;
  const title = input.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";

  if (wordCount < 80) return { render: true, reason: "thin_html" };
  if (APP_SHELL.test(input.html) && wordCount < 200) {
    return { render: true, reason: "app_shell" };
  }
  if (!title || DEFAULT_TITLES.test(title)) return { render: true, reason: "weak_title" };
  if ((input.html.match(/<script/gi)?.length ?? 0) >= 8 && wordCount < 150) {
    return { render: true, reason: "script_heavy" };
  }
  return { render: false, reason: "html_sufficient" };
}

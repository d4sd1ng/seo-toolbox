import { load } from "cheerio";
import { hostnameOf, normalizeUrl } from "core";

const SKIP_EXT =
  /\.(pdf|jpe?g|png|gif|webp|svg|ico|css|js|mjs|map|woff2?|ttf|eot|mp4|webm|zip|rar|gz|xml|json)$/i;

export type ExtractedPage = {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  h1Count: number;
  canonicalUrl: string | null;
  robots: string[];
  wordCount: number;
  schemaTypes: string[];
  internalOut: string[];
  externalOutCount: number;
};

export function extractPage(input: {
  baseUrl: string;
  html: string;
  includeSubdomains: boolean;
  primaryHost: string;
}): ExtractedPage {
  const $ = load(input.html);
  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const canonicalRaw = $('link[rel="canonical"]').attr("href") ?? null;
  const robots = (
    $('meta[name="robots"]').attr("content") ??
    $('meta[name="googlebot"]').attr("content") ??
    ""
  )
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);

  const text = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  const schemaTypes = $('[type="application/ld+json"]')
    .map((_, el) => typesFromJson($(el).text()))
    .get()
    .flat();

  const internal = new Set<string>();
  let externalOutCount = 0;
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
      return;
    }
    let absolute: string;
    try {
      absolute = new URL(href, input.baseUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/i.test(absolute)) return;
    const path = new URL(absolute).pathname;
    if (SKIP_EXT.test(path)) return;
    if (isInternal(absolute, input.primaryHost, input.includeSubdomains)) {
      try {
        internal.add(normalizeUrl(absolute));
      } catch {
        /* ignore */
      }
    } else {
      externalOutCount += 1;
    }
  });

  return {
    title,
    metaDescription,
    h1: h1s[0] ?? null,
    h1Count: h1s.length,
    canonicalUrl: resolve(input.baseUrl, canonicalRaw),
    robots,
    wordCount,
    schemaTypes: [...new Set(schemaTypes)],
    internalOut: [...internal],
    externalOutCount,
  };
}

export function shouldSkipUrl(url: string) {
  try {
    return SKIP_EXT.test(new URL(url).pathname);
  } catch {
    return true;
  }
}

export function isInternal(url: string, primaryHost: string, includeSubdomains: boolean) {
  const host = new URL(url).hostname.toLowerCase();
  const bare = host.replace(/^www\./, "");
  if (bare === primaryHost) return true;
  if (includeSubdomains && bare.endsWith(`.${primaryHost}`)) return true;
  return false;
}

function resolve(base: string, maybe: string | null) {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return maybe;
  }
}

function typesFromJson(json: string): string[] {
  try {
    const data = JSON.parse(json);
    const items = Array.isArray(data) ? data : [data];
    return items.flatMap((item) => {
      const t = item?.["@type"];
      if (!t) return [];
      return Array.isArray(t) ? t : [t];
    });
  } catch {
    return [];
  }
}

export { hostnameOf };

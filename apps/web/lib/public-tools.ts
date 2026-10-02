import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Agent, fetch } from "undici";
import { analyzeHtml } from "module-onpage";
import { DataForSeoRateLimitError, dfsPost, hasDataForSeo, hasSerper, serperAutocomplete } from "module-intel/public-provider";

const MAX_BYTES = 1_000_000;

function isPublicAddress(address: string) {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 0 || b === 168)) || (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (isIP(address) === 6) return /^([23])[0-9a-f]{3}:/i.test(address);
  return false;
}

async function validatedTarget(raw: string) {
  const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  if (url.protocol !== "https:" || url.port || url.username || url.password || !url.hostname.includes(".")) {
    throw new Error("Bitte eine öffentliche HTTPS-URL ohne Port eingeben.");
  }
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some((row) => !isPublicAddress(row.address))) {
    throw new Error("Diese URL ist nicht öffentlich erreichbar.");
  }
  url.hash = "";
  return { url, address: addresses[0] };
}

export async function safeTarget(raw: string) {
  return (await validatedTarget(raw)).url;
}

export async function publicFetch(raw: string, accept = "text/html") {
  let target = await validatedTarget(raw);
  for (let hop = 0; hop < 4; hop += 1) {
    const { url, address } = target;
    const dispatcher = new Agent({
      connect: {
        lookup: (_hostname, options, callback) => {
          if (options.all) callback(null, [address]);
          else callback(null, address.address, address.family);
        },
      },
    });
    let response;
    try {
      response = await fetch(url, {
        dispatcher,
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
        headers: { accept, "user-agent": "NurovelleSEOCheck/1.0" },
      });
    } catch (error) {
      await dispatcher.close();
      throw error;
    }
    try {
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("Weiterleitung ohne Ziel.");
        target = await validatedTarget(new URL(location, url).toString());
        continue;
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Leere Antwort.");
      const chunks: Uint8Array[] = [];
      let length = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > MAX_BYTES) throw new Error("Antwort ist zu groß.");
          chunks.push(value);
        }
      } finally {
        await reader.cancel().catch(() => undefined);
      }
      return { url: url.toString(), status: response.status, contentType: response.headers.get("content-type") ?? "", text: Buffer.concat(chunks).toString("utf8") };
    } finally {
      await response.body?.cancel().catch(() => undefined);
      await dispatcher.close();
    }
  }
  throw new Error("Zu viele Weiterleitungen.");
}

export async function audit(url: string) {
  const page = await publicFetch(url);
  if (!page.contentType.includes("html")) throw new Error("Die URL liefert kein HTML.");
  return { url: page.url, status: page.status, ...analyzeHtml({ url: page.url, finalUrl: page.url, status: page.status, html: page.text }) };
}

export async function robotsSitemap(url: string) {
  const base = await safeTarget(url);
  const [robots, sitemap] = await Promise.all([
    publicFetch(new URL("/robots.txt", base).toString(), "text/plain"),
    publicFetch(new URL("/sitemap.xml", base).toString(), "application/xml,text/xml"),
  ]);
  return {
    origin: base.origin,
    robots: { url: robots.url, status: robots.status, found: robots.status === 200, sitemaps: [...robots.text.matchAll(/^sitemap:\s*(\S+)/gim)].map((match) => match[1]).slice(0, 20) },
    sitemap: { url: sitemap.url, status: sitemap.status, found: sitemap.status === 200, urls: sitemap.status === 200 ? (sitemap.text.match(/<loc\s*>/gi) ?? []).length : 0 },
  };
}

function pageLinks(html: string, base: string) {
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)];
  return [...new Set(links.flatMap((match) => {
    try {
      const url = new URL(match[1], base);
      return url.origin === new URL(base).origin && url.protocol === "https:" ? [url.toString().split("#")[0]] : [];
    } catch { return []; }
  }))];
}

export async function crawlDemo(url: string) {
  const start = await safeTarget(url);
  const queue = [start.toString()];
  const seen = new Set(queue);
  const pages = [];
  while (queue.length && pages.length < 3) {
    const current = queue.shift()!;
    try {
      const page = await publicFetch(current);
      const analysis = page.contentType.includes("html") ? analyzeHtml({ url: page.url, finalUrl: page.url, status: page.status, html: page.text }) : null;
      pages.push({ url: page.url, status: page.status, score: analysis?.score ?? null, title: analysis?.metrics.title ?? null, h1: analysis?.metrics.h1 ?? null });
      if (analysis) {
        for (const link of pageLinks(page.text, page.url)) {
          if (!seen.has(link) && seen.size < 12) { seen.add(link); queue.push(link); }
        }
      }
    } catch (error) {
      pages.push({ url: current, status: 0, score: null, title: null, h1: null, error: error instanceof Error ? error.message : "Abruf fehlgeschlagen" });
    }
  }
  return { seedUrl: start.toString(), pages, crawled: pages.length, maxPages: 3 };
}

export async function keywordCheck(seed: string) {
  const keyword = seed.trim().slice(0, 120);
  if (!keyword) throw new Error("Keyword fehlt.");
  let suggestions: string[] = [];
  let provider = "serper";
  if (hasDataForSeo()) {
    try {
      const result = await dfsPost<{ tasks?: Array<{ result?: Array<{ items?: Array<{ keyword?: string }> }> }> }>("/v3/dataforseo_labs/google/keyword_ideas/live", [
        { keywords: [keyword], location_name: "Germany", language_code: "de", limit: 10 },
      ]);
      suggestions = (result.tasks?.[0]?.result?.[0]?.items ?? []).flatMap((row) => row.keyword ? [row.keyword] : []);
      provider = "dataforseo";
    } catch (error) {
      if (!(error instanceof DataForSeoRateLimitError)) throw error;
      if (!(await hasSerper())) throw error;
      suggestions = await serperAutocomplete(keyword, undefined, { strict: true });
    }
  } else {
    if (!(await hasSerper())) throw new Error("Keyword-Anbieter nicht konfiguriert.");
    suggestions = await serperAutocomplete(keyword, undefined, { strict: true });
  }
  return { seed: keyword, provider, suggestions: [...new Set([keyword, ...suggestions])].slice(0, 10) };
}

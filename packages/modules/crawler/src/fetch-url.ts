import { CRAWLER_UA } from "./user-agent";

const TIMEOUT_MS = 12_000;

export type RedirectHop = { url: string; status: number };
export type FetchResult = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  html: string;
  contentType: string;
  chain: RedirectHop[];
  error?: string;
  rendered?: boolean;
  rawHtml?: string;
  renderMs?: number;
  renderError?: string;
};

export async function fetchUrl(url: string, maxHops = 8): Promise<FetchResult> {
  const chain: RedirectHop[] = [];
  let current = url;

  for (let hop = 0; hop < maxHops; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(current, {
        redirect: "manual",
        signal: controller.signal,
        headers: { "user-agent": CRAWLER_UA, accept: "text/html,application/xhtml+xml" },
      });
      chain.push({ url: current, status: res.status });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          return empty(url, current, res.status, chain, "Redirect ohne Location");
        }
        current = new URL(location, current).toString();
        continue;
      }

      const contentType = res.headers.get("content-type") ?? "";
      const html = contentType.includes("html") ? await res.text() : "";
      return {
        requestedUrl: url,
        finalUrl: current,
        status: res.status,
        html,
        contentType,
        chain,
      };
    } catch (error) {
      return empty(
        url,
        current,
        0,
        chain,
        error instanceof Error ? error.message : "Fetch fehlgeschlagen",
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return empty(url, current, 0, chain, "Redirect-Kette zu lang");
}

function empty(
  requestedUrl: string,
  finalUrl: string,
  status: number,
  chain: RedirectHop[],
  error: string,
): FetchResult {
  return {
    requestedUrl,
    finalUrl,
    status,
    html: "",
    contentType: "",
    chain,
    error,
  };
}

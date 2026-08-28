function dfsAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return Buffer.from(`${login}:${password}`).toString("base64");
}

export function hasDataForSeo() {
  return Boolean(dfsAuth());
}

export function hasSerper() {
  return Boolean(process.env.SERPER_API_KEY);
}

export async function dfsPost<T>(path: string, body: unknown): Promise<T> {
  const token = dfsAuth();
  if (!token) throw new Error("DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD fehlen.");
  const res = await fetch(`https://api.dataforseo.com${path}`, {
    method: "POST",
    headers: {
      authorization: `Basic ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { status_message?: string; tasks?: Array<{ status_message?: string }> };
  if (!res.ok) {
    throw new Error(json.status_message ?? `DataForSEO HTTP ${res.status}`);
  }
  return json;
}

export async function serperSearch(query: string, country = "de") {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_API_KEY fehlt.");
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({ q: query, gl: country.toLowerCase(), hl: "de", num: 10 }),
  });
  const json = (await res.json()) as {
    organic?: Array<{ title: string; link: string; snippet?: string; position: number }>;
    error?: string;
  };
  if (!res.ok) throw new Error(json.error ?? `Serper HTTP ${res.status}`);
  return json.organic ?? [];
}

export type SerpRow = {
  position: number;
  url: string;
  title: string;
  domain: string;
};

export async function fetchOrganicSerp(query: string, country = "Germany"): Promise<SerpRow[]> {
  if (hasDataForSeo()) {
    const json = await dfsPost<{
      tasks?: Array<{ result?: Array<{ items?: Array<{ url?: string; title?: string; rank_group?: number }> }> }>;
    }>("/v3/serp/google/organic/live/regular", [
      {
        keyword: query,
        location_name: country,
        language_code: "de",
        depth: 10,
      },
    ]);
    const items = json.tasks?.[0]?.result?.[0]?.items ?? [];
    return items
      .filter((item) => item.url)
      .map((item) => ({
        position: item.rank_group ?? 0,
        url: item.url!,
        title: item.title ?? "",
        domain: safeHost(item.url!),
      }));
  }
  if (hasSerper()) {
    const rows = await serperSearch(query);
    return rows.map((row) => ({
      position: row.position,
      url: row.link,
      title: row.title,
      domain: safeHost(row.link),
    }));
  }
  throw new Error("Weder DataForSEO noch Serper konfiguriert.");
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

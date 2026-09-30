import { decryptJson } from "core";
import { prisma } from "db";

export type SerperErrorCode =
  | "missing_key"
  | "invalid_key"
  | "rate_limited"
  | "payment_required"
  | "bad_request"
  | "timeout"
  | "unavailable"
  | "unknown";

export class SerperError extends Error {
  readonly code: SerperErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  constructor(code: SerperErrorCode, message: string, status = 0, retryable = false) {
    super(message);
    this.name = "SerperError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

export class DataForSeoRateLimitError extends Error {
  constructor() {
    super("DataForSEO Rate-Limit erreicht.");
    this.name = "DataForSeoRateLimitError";
  }
}

function classifySerper(status: number, bodyMessage: string): SerperError {
  const msg = bodyMessage || `Serper HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new SerperError("invalid_key", "Serper-Key ungültig oder ohne Rechte. Key in Settings prüfen.", status);
  }
  if (status === 402) {
    return new SerperError("payment_required", "Serper-Guthaben leer. Credits aufladen.", status);
  }
  if (status === 429) {
    return new SerperError("rate_limited", "Serper Rate-Limit. In einer Minute erneut versuchen.", status, true);
  }
  if (status === 400) {
    return new SerperError("bad_request", `Serper lehnt die Anfrage ab: ${msg}`, status);
  }
  if (status === 408 || status === 504) {
    return new SerperError("timeout", "Serper antwortet nicht rechtzeitig.", status, true);
  }
  if (status >= 500) {
    return new SerperError("unavailable", `Serper ist gerade nicht erreichbar (${status}).`, status, true);
  }
  return new SerperError("unknown", msg, status, status >= 500);
}

async function markSerperBroken(workspaceId: string | undefined, code: SerperErrorCode) {
  if (!workspaceId) return;
  if (code !== "invalid_key" && code !== "payment_required") return;
  await prisma.integration.updateMany({
    where: { workspaceId, provider: "serper" },
    data: { status: "needs_reauth" },
  });
}

function dfsAuth() {
  const login = process.env.DATAFORSEO_LOGIN;
  const password = process.env.DATAFORSEO_PASSWORD;
  if (!login || !password) return null;
  return Buffer.from(`${login}:${password}`).toString("base64");
}

export function hasDataForSeo() {
  return Boolean(dfsAuth());
}

export async function resolveSerperKey(workspaceId?: string) {
  if (workspaceId) {
    const row = await prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "serper" } },
    });
    if (row?.credentialsRef) {
      try {
        const creds = decryptJson<{ apiKey?: string }>(row.credentialsRef);
        if (creds.apiKey) return creds.apiKey;
      } catch {
        /* fall through to env */
      }
    }
  }
  return process.env.SERPER_API_KEY || null;
}

export async function hasSerper(workspaceId?: string) {
  return Boolean(await resolveSerperKey(workspaceId));
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
  const json = (await res.json()) as T & {
    status_code?: number;
    status_message?: string;
    tasks?: Array<{ status_code?: number }>;
  };
  if (
    res.status === 429 ||
    json.status_code === 40202 ||
    json.status_code === 40209 ||
    json.tasks?.some((task) => task.status_code === 40202 || task.status_code === 40209)
  ) {
    throw new DataForSeoRateLimitError();
  }
  if (!res.ok) {
    throw new Error(json.status_message ?? `DataForSEO HTTP ${res.status}`);
  }
  return json;
}

export type SerperOrganic = {
  title: string;
  link: string;
  snippet?: string;
  position: number;
};

export type SerperSearchResult = {
  organic: SerperOrganic[];
  peopleAlsoAsk: string[];
  related: string[];
};

async function serperFetch(path: string, payload: Record<string, unknown>, workspaceId?: string) {
  const key = await resolveSerperKey(workspaceId);
  if (!key) {
    throw new SerperError(
      "missing_key",
      "Kein Serper-Key. Unter Settings einen Key speichern oder SERPER_API_KEY setzen.",
    );
  }
  let lastError: SerperError | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let res: Response;
    try {
      res = await fetch(`https://google.serper.dev/${path}`, {
        method: "POST",
        headers: { "x-api-key": key, "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20_000),
      });
    } catch (error) {
      const timeout = error instanceof Error && /timeout|aborted/i.test(error.message);
      lastError = new SerperError(
        timeout ? "timeout" : "unavailable",
        timeout ? "Serper-Timeout nach 20s." : "Serper nicht erreichbar.",
        0,
        true,
      );
      break;
    }
    if (res.ok) {
      const json = (await res.json()) as Record<string, unknown>;
      return json;
    }
    let bodyMessage = `Serper HTTP ${res.status}`;
    try {
      const json = (await res.json()) as { error?: string; message?: string };
      bodyMessage = json.error ?? json.message ?? bodyMessage;
    } catch {
      /* ignore */
    }
    const classified = classifySerper(res.status, bodyMessage);
    await markSerperBroken(workspaceId, classified.code);
    lastError = classified;
    if (classified.retryable && attempt === 0) {
      const wait = Number(res.headers.get("retry-after")) * 1000;
      await new Promise((r) => setTimeout(r, Number.isFinite(wait) && wait > 0 ? Math.min(wait, 8000) : 1500));
      continue;
    }
    break;
  }
  throw lastError ?? new SerperError("unknown", "Serper-Fehler", 0);
}

export async function serperSearch(
  query: string,
  opts?: { country?: string; lang?: string; num?: number; workspaceId?: string },
): Promise<SerperSearchResult> {
  const q = query.trim();
  if (!q) throw new SerperError("bad_request", "Leere Suchanfrage an Serper.");
  const gl = (opts?.country ?? "de").toLowerCase().slice(0, 2);
  const json = (await serperFetch(
    "search",
    { q, gl, hl: opts?.lang ?? "de", num: opts?.num ?? 10 },
    opts?.workspaceId,
  )) as {
    organic?: SerperOrganic[];
    peopleAlsoAsk?: Array<{ question?: string }>;
    relatedSearches?: Array<{ query?: string }>;
  };
  return {
    organic: json.organic ?? [],
    peopleAlsoAsk: (json.peopleAlsoAsk ?? [])
      .map((p) => p.question)
      .filter((item): item is string => Boolean(item)),
    related: (json.relatedSearches ?? [])
      .map((r) => r.query)
      .filter((item): item is string => Boolean(item)),
  };
}

export async function serperAutocomplete(
  seed: string,
  workspaceId?: string,
  options: { strict?: boolean } = {},
) {
  const q = seed.trim();
  if (!q) return [] as string[];
  try {
    const json = (await serperFetch("autocomplete", { q, gl: "de", hl: "de" }, workspaceId)) as {
      suggestions?: Array<{ value?: string } | string>;
    };
    return (json.suggestions ?? [])
      .map((s) => (typeof s === "string" ? s : s.value))
      .filter((s): s is string => Boolean(s));
  } catch (error) {
    if (options.strict || (error instanceof SerperError && (error.code === "invalid_key" || error.code === "missing_key"))) {
      throw error;
    }
    return [];
  }
}

export type SerpRow = {
  position: number;
  url: string;
  title: string;
  domain: string;
  snippet?: string;
};

export async function fetchOrganicSerp(
  query: string,
  opts?: { country?: string; workspaceId?: string },
): Promise<SerpRow[]> {
  const workspaceId = opts?.workspaceId;
  let dfsRateLimitError: DataForSeoRateLimitError | null = null;
  if (hasDataForSeo()) {
    try {
      const json = await dfsPost<{
        tasks?: Array<{
          result?: Array<{ items?: Array<{ url?: string; title?: string; rank_group?: number }> }>;
        }>;
      }>("/v3/serp/google/organic/live/regular", [
        {
          keyword: query,
          location_name: countryName(opts?.country),
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
    } catch (error) {
      if (!(error instanceof DataForSeoRateLimitError)) throw error;
      dfsRateLimitError = error;
    }
  }
  if (await hasSerper(workspaceId)) {
    const result = await serperSearch(query, {
      country: opts?.country ?? "de",
      workspaceId,
    });
    return result.organic.map((row) => ({
      position: row.position,
      url: row.link,
      title: row.title,
      domain: safeHost(row.link),
      snippet: row.snippet,
    }));
  }
  if (dfsRateLimitError) throw dfsRateLimitError;
  throw new Error("Weder Serper noch DataForSEO konfiguriert.");
}

export async function fetchSerpExtras(query: string, workspaceId?: string) {
  if (!(await hasSerper(workspaceId))) {
    return { peopleAlsoAsk: [] as string[], related: [] as string[] };
  }
  const result = await serperSearch(query, { workspaceId });
  return { peopleAlsoAsk: result.peopleAlsoAsk, related: result.related };
}

function countryName(code?: string) {
  const c = (code ?? "de").toLowerCase();
  if (c === "at") return "Austria";
  if (c === "ch") return "Switzerland";
  return "Germany";
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

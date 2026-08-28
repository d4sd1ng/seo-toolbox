import { decryptJson, encryptJson } from "core";
import { prisma } from "db";
import { refreshAccessToken } from "./oauth";

export type GscTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number;
  email?: string;
};

export type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

const API = "https://www.googleapis.com/webmasters/v3";

export async function loadGscTokens(workspaceId: string): Promise<GscTokens> {
  const integration = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId, provider: "gsc" } },
  });
  if (!integration) throw new Error("Search Console ist nicht verbunden.");
  let tokens = decryptJson<GscTokens>(integration.credentialsRef);
  if (tokens.expiryDate < Date.now() + 60_000) {
    if (!tokens.refreshToken) throw new Error("GSC-Refresh-Token fehlt. Neu verbinden.");
    const next = await refreshAccessToken(tokens.refreshToken);
    tokens = { ...tokens, ...next };
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        credentialsRef: encryptJson(tokens),
        status: "connected",
        lastSyncAt: integration.lastSyncAt,
      },
    });
  }
  return tokens;
}

export async function listGscSites(accessToken: string) {
  const res = await gscFetch(accessToken, `${API}/sites`);
  const json = (await res.json()) as {
    siteEntry?: Array<{ siteUrl: string; permissionLevel: string }>;
    error?: { message: string };
  };
  if (!res.ok) throw new Error(json.error?.message ?? "Sites konnten nicht geladen werden");
  return json.siteEntry ?? [];
}

export async function querySearchAnalytics(input: {
  accessToken: string;
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  rowLimit?: number;
  startRow?: number;
}) {
  const url = `${API}/sites/${encodeURIComponent(input.siteUrl)}/searchAnalytics/query`;
  const res = await gscFetch(input.accessToken, url, {
    method: "POST",
    body: JSON.stringify({
      startDate: input.startDate,
      endDate: input.endDate,
      dimensions: input.dimensions,
      rowLimit: input.rowLimit ?? 1000,
      startRow: input.startRow ?? 0,
    }),
  });
  const json = (await res.json()) as { rows?: GscRow[]; error?: { message: string } };
  if (!res.ok) throw new Error(json.error?.message ?? "Search-Analytics-Query fehlgeschlagen");
  return json.rows ?? [];
}

async function gscFetch(accessToken: string, url: string, init?: RequestInit) {
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

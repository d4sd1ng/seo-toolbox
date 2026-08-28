import { createHmac } from "node:crypto";

const SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"];

export type OAuthState = {
  workspaceId: string;
  projectId: string;
};

export function gscAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: required("GOOGLE_CLIENT_ID"),
    redirect_uri: required("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  const body = new URLSearchParams({
    code,
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    redirect_uri: required("GOOGLE_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? "Token-Tausch fehlgeschlagen");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiryDate: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export async function refreshAccessToken(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: required("GOOGLE_CLIENT_ID"),
    client_secret: required("GOOGLE_CLIENT_SECRET"),
    grant_type: "refresh_token",
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token) {
    throw new Error(json.error ?? "Refresh fehlgeschlagen");
  }
  return {
    accessToken: json.access_token,
    expiryDate: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
}

export function signState(state: OAuthState) {
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function readState(raw: string): OAuthState {
  const [payload, sig] = raw.split(".");
  if (!payload || !sig || hmac(payload) !== sig) {
    throw new Error("OAuth-State ungültig");
  }
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as OAuthState;
}

function hmac(payload: string) {
  return createHmac("sha256", required("ENCRYPTION_KEY")).update(payload).digest("base64url");
}

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} fehlt`);
  return value;
}

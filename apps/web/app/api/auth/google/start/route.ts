import { NextResponse } from "next/server";
import { googleClient, GOOGLE_NEXT_COOKIE, GOOGLE_STATE_COOKIE, newState, safeNext, temporaryCookieOptions } from "@/lib/google-login";

export async function GET(request: Request) {
  try {
    const client = googleClient();
    const state = newState();
    const query = new URL(request.url).searchParams;
    const next = query.get("return") === "homepage" ? "homepage" : safeNext(query.get("next"));
    const authUrl = client.generateAuthUrl({
      access_type: "online",
      scope: ["openid", "email", "profile"],
      state,
    });
    const response = NextResponse.redirect(authUrl);
    response.cookies.set(GOOGLE_STATE_COOKIE, state, temporaryCookieOptions());
    response.cookies.set(GOOGLE_NEXT_COOKIE, next, temporaryCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ error: "Google-Login ist nicht konfiguriert" }, { status: 503 });
  }
}

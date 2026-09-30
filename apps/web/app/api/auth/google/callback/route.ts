import { prisma } from "db";
import { NextRequest, NextResponse } from "next/server";
import { attachSessionCookie, createSessionToken } from "@/lib/auth";
import { googleClient, GOOGLE_NEXT_COOKIE, GOOGLE_STATE_COOKIE, safeNext, temporaryCookieOptions, validState } from "@/lib/google-login";

function clearGoogleCookies(response: NextResponse) {
  const options = { ...temporaryCookieOptions(), maxAge: 0 };
  response.cookies.set(GOOGLE_STATE_COOKIE, "", options);
  response.cookies.set(GOOGLE_NEXT_COOKIE, "", options);
  return response;
}

function loginError(request: NextRequest, message: string) {
  const url = new URL("/login", request.url);
  url.searchParams.set("error", message);
  return clearGoogleCookies(NextResponse.redirect(url));
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  if (!validState(query.get("state"), request.cookies.get(GOOGLE_STATE_COOKIE)?.value)) {
    return loginError(request, "Google-Login konnte nicht bestätigt werden");
  }
  if (query.get("error") || !query.get("code")) {
    return loginError(request, "Google-Login wurde abgebrochen");
  }

  try {
    const client = googleClient();
    const { tokens } = await client.getToken(query.get("code")!);
    if (!tokens.id_token) throw new Error("Google-ID-Token fehlt");
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const profile = ticket.getPayload();
    if (!profile?.email || profile.email_verified !== true) {
      throw new Error("Google-E-Mail ist nicht verifiziert");
    }

    const email = profile.email.toLowerCase();
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, name: profile.name ?? null },
      update: {},
      include: { memberships: true },
    });
    let membership = user.memberships[0];
    if (!membership) {
      const workspace = await prisma.workspace.create({
        data: {
          name: `${profile.name || email.split("@")[0]} Workspace`,
          slug: `google-${user.id}`,
          plan: "free",
        },
      });
      membership = await prisma.membership.create({
        data: { userId: user.id, workspaceId: workspace.id, role: "owner" },
      });
    }
    const token = await createSessionToken(user.id, membership.workspaceId);
    const storedNext = request.cookies.get(GOOGLE_NEXT_COOKIE)?.value ?? null;
    const destination = storedNext === "homepage"
      ? new URL("https://nurovelle.de/homepage/detail_seo.html?owner=1")
      : new URL(safeNext(storedNext), request.url);
    const response = attachSessionCookie(NextResponse.redirect(destination), token);
    return clearGoogleCookies(response);
  } catch (error) {
    console.error("google-login", error);
    return loginError(request, "Google-Login fehlgeschlagen");
  }
}

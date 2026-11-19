import { NextResponse } from "next/server";
import { attachSessionCookie } from "@/lib/auth";

export async function readAuthFields(request: Request) {
  const ctype = request.headers.get("content-type") ?? "";
  if (ctype.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
      name?: string;
    };
    return {
      email: body.email?.trim() ?? "",
      password: body.password ?? "",
      name: body.name?.trim() ?? "",
      json: true,
      next: "/",
    };
  }
  const form = await request.formData().catch(() => null);
  return {
    email: String(form?.get("email") ?? "").trim(),
    password: String(form?.get("password") ?? ""),
    name: String(form?.get("name") ?? "").trim(),
    json: false,
    next: String(form?.get("next") ?? "/") || "/",
  };
}

export function authRedirectUrl(request: Request, next = "/") {
  const base = new URL(process.env.NEXT_PUBLIC_APP_URL || request.url);
  try {
    const destination = new URL(next.startsWith("/") ? next : "/", base);
    if (destination.origin === base.origin) return destination;
  } catch {
    // Malformed return paths stay on the application origin.
  }
  return new URL("/", base);
}

export function authError(json: boolean, request: Request, message: string, status = 400) {
  if (json) return NextResponse.json({ error: message }, { status });
  const url = authRedirectUrl(request, "/login");
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export function authOk(json: boolean, request: Request, token: string, next = "/") {
  if (json) return attachSessionCookie(NextResponse.json({ ok: true }), token);
  return attachSessionCookie(NextResponse.redirect(authRedirectUrl(request, next)), token);
}

export function prismaHint(error: unknown) {
  const message = error instanceof Error ? error.message : "Unbekannter Fehler";
  if (/session|does not exist|Unknown arg|Unknown model/i.test(message)) {
    return "Datenbank-Schema unvollständig (Tabelle Session). Einmal pnpm db:push ausführen.";
  }
  if (/Can't reach database|ECONNREFUSED|P1001|P1017|PrismaClient/i.test(message)) {
    return "Datenbank nicht erreichbar. Docker/Postgres, DATABASE_URL und pnpm db:generate prüfen.";
  }
  return message;
}

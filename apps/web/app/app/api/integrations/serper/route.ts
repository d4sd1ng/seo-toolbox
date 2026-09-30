import { encryptJson } from "core";
import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const row = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId: session.workspaceId, provider: "serper" } },
  });
  return NextResponse.json({
    connected: Boolean(row) || Boolean(process.env.SERPER_API_KEY),
    source: row ? "workspace" : process.env.SERPER_API_KEY ? "env" : null,
    status: row?.status ?? (process.env.SERPER_API_KEY ? "connected" : null),
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const actor = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: session.workspaceId, userId: session.userId },
    },
  });
  if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Nur Owner/Admin" }, { status: 403 });
  }
  const body = (await request.json()) as { apiKey?: string };
  if (!body.apiKey || body.apiKey.length < 8) {
    return NextResponse.json({ error: "apiKey fehlt" }, { status: 400 });
  }
  const probe = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "x-api-key": body.apiKey, "content-type": "application/json" },
    body: JSON.stringify({ q: "seo", gl: "de", hl: "de", num: 1 }),
  });
  if (!probe.ok) {
    return NextResponse.json({ error: "Serper hat den Key abgelehnt" }, { status: 400 });
  }
  await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: session.workspaceId, provider: "serper" } },
    create: {
      workspaceId: session.workspaceId,
      provider: "serper",
      status: "connected",
      accountLabel: "Serper",
      credentialsRef: encryptJson({ apiKey: body.apiKey }),
    },
    update: {
      status: "connected",
      credentialsRef: encryptJson({ apiKey: body.apiKey }),
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  await prisma.integration.deleteMany({
    where: { workspaceId: session.workspaceId, provider: "serper" },
  });
  return NextResponse.json({ ok: true });
}

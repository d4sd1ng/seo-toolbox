import { prisma, workspacePlanCaps } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const actor = await prisma.membership.findUnique({
    where: {
      workspaceId_userId: { workspaceId: session.workspaceId, userId: session.userId },
    },
  });
  if (!actor || (actor.role !== "owner" && actor.role !== "admin")) {
    return NextResponse.json({ error: "Nur Owner/Admin dürfen einladen" }, { status: 403 });
  }
  const body = (await request.json()) as { email?: string; role?: "admin" | "member" };
  if (!body.email) return NextResponse.json({ error: "E-Mail fehlt" }, { status: 400 });
  const email = body.email.toLowerCase().trim();
  const caps = await workspacePlanCaps(session.workspaceId);
  const memberCount = await prisma.membership.count({ where: { workspaceId: session.workspaceId } });
  if (memberCount >= caps.members) {
    return NextResponse.json(
      { error: `Mitglieder-Limit auf Plan ${caps.plan}: ${caps.members}` },
      { status: 402 },
    );
  }
  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name: email.split("@")[0] },
  });
  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: session.workspaceId, userId: user.id } },
    update: { role: body.role ?? "member" },
    create: { workspaceId: session.workspaceId, userId: user.id, role: body.role ?? "member" },
  });
  return NextResponse.json({ ok: true });
}

import { prisma } from "db";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  if (!body.email || !body.password) {
    return NextResponse.json({ error: "Login unvollständig" }, { status: 400 });
  }
  const user = await prisma.user.findUnique({
    where: { email: body.email.toLowerCase().trim() },
    include: { memberships: true },
  });
  if (!user?.passwordHash || !verifyPassword(body.password, user.passwordHash)) {
    return NextResponse.json({ error: "E-Mail oder Passwort falsch" }, { status: 401 });
  }
  const last = await prisma.session.findFirst({
    where: { userId: user.id },
    orderBy: { lastSeenAt: "desc" },
  });
  const membership =
    user.memberships.find((m) => m.workspaceId === last?.workspaceId) ??
    user.memberships.find((m) => m.role === "owner") ??
    user.memberships[0];
  if (!membership) {
    return NextResponse.json({ error: "Kein Workspace" }, { status: 403 });
  }
  await setSessionCookie({ userId: user.id, workspaceId: membership.workspaceId });
  return NextResponse.json({ ok: true });
}

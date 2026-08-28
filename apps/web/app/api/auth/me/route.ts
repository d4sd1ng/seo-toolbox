import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId },
    include: { workspace: true },
  });
  return NextResponse.json({
    user: session.user,
    workspaceId: session.workspaceId,
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      plan: m.workspace.plan,
      role: m.role,
    })),
  });
}

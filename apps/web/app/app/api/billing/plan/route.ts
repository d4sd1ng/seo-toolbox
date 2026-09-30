import { prisma } from "db";
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
    return NextResponse.json({ error: "Nur Owner/Admin dürfen den Plan ändern" }, { status: 403 });
  }
  const body = (await request.json()) as { plan?: "free" | "pro" | "agency" };
  if (!body.plan) return NextResponse.json({ error: "Plan fehlt" }, { status: 400 });
  if (process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Plan läuft über Stripe Checkout / Portal" },
      { status: 400 },
    );
  }
  await prisma.workspace.update({
    where: { id: session.workspaceId },
    data: { plan: body.plan },
  });
  return NextResponse.json({ ok: true, plan: body.plan });
}

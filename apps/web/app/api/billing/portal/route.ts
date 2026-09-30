import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appUrl, stripeForm } from "@/lib/stripe";

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
  });
  if (!workspace.stripeCustomerId) {
    return NextResponse.json({ error: "Noch kein Stripe-Kunde" }, { status: 400 });
  }
  const portal = await stripeForm("billing_portal/sessions", {
    customer: workspace.stripeCustomerId,
    return_url: `${appUrl()}/settings`,
  });
  return NextResponse.json({ url: portal.url });
}

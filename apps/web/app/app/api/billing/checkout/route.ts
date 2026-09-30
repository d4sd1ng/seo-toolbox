import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { appUrl, priceIdForPlan, stripeForm, type PaidPlan } from "@/lib/stripe";

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
  const body = (await request.json()) as { plan?: PaidPlan };
  if (body.plan !== "pro" && body.plan !== "agency") {
    return NextResponse.json({ error: "Plan muss pro oder agency sein" }, { status: 400 });
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
  });
  let customerId = workspace.stripeCustomerId;
  if (!customerId) {
    const customer = await stripeForm("customers", {
      email: session.user.email,
      name: workspace.name,
      "metadata[workspaceId]": workspace.id,
    });
    customerId = String(customer.id);
    await prisma.workspace.update({
      where: { id: workspace.id },
      data: { stripeCustomerId: customerId },
    });
  }
  const checkout = await stripeForm("checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    success_url: `${appUrl()}/settings?billing=success`,
    cancel_url: `${appUrl()}/settings?billing=cancel`,
    "line_items[0][price]": priceIdForPlan(body.plan),
    "line_items[0][quantity]": "1",
    "subscription_data[metadata][workspaceId]": workspace.id,
    "metadata[workspaceId]": workspace.id,
    "metadata[plan]": body.plan,
    allow_promotion_codes: "true",
  });
  return NextResponse.json({ url: checkout.url });
}

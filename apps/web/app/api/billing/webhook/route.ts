import { prisma } from "db";
import { NextResponse } from "next/server";
import { planForPriceId, verifyStripeSignature } from "@/lib/stripe";

type StripeObj = Record<string, unknown>;

function priceFromSub(sub: StripeObj | null | undefined) {
  const items = sub?.items as { data?: Array<{ price?: { id?: string } }> } | undefined;
  return items?.data?.[0]?.price?.id ?? null;
}

async function applySubscription(workspaceId: string | undefined, sub: StripeObj) {
  if (!workspaceId) return;
  const status = String(sub.status ?? "");
  const priceId = priceFromSub(sub);
  const paid = status === "active" || status === "trialing";
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      plan: paid ? planForPriceId(priceId) : "free",
      stripeSubscriptionId: String(sub.id ?? ""),
      stripePriceId: priceId,
    },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }
  const event = JSON.parse(raw) as { type: string; data: { object: StripeObj } };
  const obj = event.data.object;
  const meta = (obj.metadata ?? {}) as { workspaceId?: string; plan?: string };

  if (event.type === "checkout.session.completed") {
    const workspaceId = meta.workspaceId;
    const subId = obj.subscription ? String(obj.subscription) : null;
    if (workspaceId && subId) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          stripeCustomerId: obj.customer ? String(obj.customer) : undefined,
          stripeSubscriptionId: subId,
          plan: meta.plan === "agency" || meta.plan === "pro" ? meta.plan : "pro",
        },
      });
    }
  }

  if (
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.created"
  ) {
    const workspaceId =
      meta.workspaceId ??
      (
        await prisma.workspace.findFirst({
          where: { stripeCustomerId: obj.customer ? String(obj.customer) : "__none__" },
        })
      )?.id;
    await applySubscription(workspaceId, obj);
  }

  if (event.type === "customer.subscription.deleted") {
    const workspace =
      (meta.workspaceId
        ? await prisma.workspace.findUnique({ where: { id: meta.workspaceId } })
        : null) ??
      (await prisma.workspace.findFirst({
        where: { stripeSubscriptionId: String(obj.id ?? "") },
      }));
    if (workspace) {
      await prisma.workspace.update({
        where: { id: workspace.id },
        data: { plan: "free", stripeSubscriptionId: null, stripePriceId: null },
      });
    }
  }

  return NextResponse.json({ received: true });
}

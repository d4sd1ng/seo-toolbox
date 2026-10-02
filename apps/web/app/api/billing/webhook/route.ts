import { prisma } from "db";
import { NextResponse } from "next/server";
import { planForPriceId, stripeGet, verifyStripeSignature } from "@/lib/stripe";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function subscriptionFrom(value: unknown) {
  if (!isRecord(value) || typeof value.id !== "string" ||
      typeof value.customer !== "string" || typeof value.status !== "string" ||
      !isRecord(value.items) || !Array.isArray(value.items.data)) return null;
  const first: unknown = value.items.data[0];
  const priceId = isRecord(first) && isRecord(first.price) && typeof first.price.id === "string"
    ? first.price.id : null;
  return { id: value.id, customer: value.customer, status: value.status, priceId };
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"))) {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }
  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Ungültiges Ereignis" }, { status: 400 });
  }
  if (!isRecord(event) || typeof event.type !== "string" ||
      !isRecord(event.data) || !isRecord(event.data.object)) {
    return NextResponse.json({ error: "Ungültiges Ereignis" }, { status: 400 });
  }
  if (!["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"].includes(event.type)) {
    return NextResponse.json({ received: true });
  }
  const object = event.data.object;
  if (typeof object.id !== "string" || !/^sub_[a-zA-Z0-9]+$/.test(object.id)) {
    return NextResponse.json({ error: "Ungültiges Abonnement" }, { status: 400 });
  }
  try {
    // Read the current subscription because Stripe can deliver events out of order.
    const subscription = subscriptionFrom(await stripeGet(`subscriptions/${object.id}`));
    if (!subscription || subscription.id !== object.id) throw new Error("Invalid Stripe subscription response");
    const ended = subscription.status === "canceled" || subscription.status === "incomplete_expired";
    const paid = subscription.status === "active" || subscription.status === "trialing";
    await prisma.workspace.updateMany({
      where: {
        stripeCustomerId: subscription.customer,
        ...(ended
          ? { stripeSubscriptionId: subscription.id }
          : { OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: subscription.id }] }),
      },
      data: {
        plan: paid ? planForPriceId(subscription.priceId) : "free",
        stripeSubscriptionId: ended ? null : subscription.id,
        stripePriceId: ended ? null : subscription.priceId,
      },
    });
  } catch {
    return NextResponse.json({ error: "Abonnement konnte nicht aktualisiert werden." }, { status: 503 });
  }
  return NextResponse.json({ received: true });
}

import { createHmac, timingSafeEqual } from "node:crypto";

export type PaidPlan = "pro" | "agency";

function secret() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY fehlt");
  return key;
}

export function priceIdForPlan(plan: PaidPlan) {
  const id =
    plan === "agency" ? process.env.STRIPE_PRICE_AGENCY : process.env.STRIPE_PRICE_PRO;
  if (!id) throw new Error(`Stripe-Preis für ${plan} fehlt`);
  return id;
}

export function planForPriceId(priceId: string | null | undefined): "free" | PaidPlan {
  if (priceId && priceId === process.env.STRIPE_PRICE_AGENCY) return "agency";
  if (priceId && priceId === process.env.STRIPE_PRICE_PRO) return "pro";
  return "free";
}

export function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export async function stripeForm(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret()}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe ${path} ${res.status}`);
  }
  return json;
}

export function verifyStripeSignature(rawBody: string, header: string | null) {
  const secretKey = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (age > 60 * 5) return false;
  const expected = createHmac("sha256", secretKey).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

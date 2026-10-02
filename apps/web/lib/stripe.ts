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

export async function stripeGet(path: string): Promise<unknown> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${secret()}` },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Stripe request failed: ${response.status}`);
  return response.json();
}

export function verifyStripeSignature(rawBody: string, header: string | null) {
  const secretKey = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !header) return false;
  const parts = header.split(",").map((part) => part.trim().split("="));
  const t = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!t || !/^\d+$/.test(t) || signatures.length === 0) return false;
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 60 * 5) return false;
  const expected = createHmac("sha256", secretKey).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  return signatures.some((signature) => {
    const b = Buffer.from(signature, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

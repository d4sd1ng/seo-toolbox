import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyStripeSignature } from "./stripe";

const body = '{"type":"customer.subscription.updated"}';
const secret = "test-webhook-secret";
function signature(timestamp: number, payload = body) {
  return createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
}

describe("Stripe webhook signature", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("accepts any valid signature during signing-secret rotation", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    const timestamp = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(body, `t=${timestamp},v1=${signature(timestamp)},v1=invalid`)).toBe(true);
  });
  it("rejects changed bodies, expired signatures, and malformed timestamps", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", secret);
    const timestamp = Math.floor(Date.now() / 1000);
    expect(verifyStripeSignature(body + " ", `t=${timestamp},v1=${signature(timestamp)}`)).toBe(false);
    expect(verifyStripeSignature(body, `t=${timestamp - 301},v1=${signature(timestamp - 301)}`)).toBe(false);
    expect(verifyStripeSignature(body, "t=NaN,v1=invalid")).toBe(false);
  });
  it("rejects unsigned requests and missing signing configuration", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(verifyStripeSignature(body, "t=1,v1=invalid")).toBe(false);
    expect(verifyStripeSignature(body, null)).toBe(false);
  });
});

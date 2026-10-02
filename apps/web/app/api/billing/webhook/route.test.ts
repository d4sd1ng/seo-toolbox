import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("db", () => ({ prisma: { workspace: { updateMany: vi.fn() } } }));
vi.mock("@/lib/stripe", () => ({
  stripeGet: vi.fn(), verifyStripeSignature: vi.fn(() => true),
  planForPriceId: (price: string) => price === "price_pro" ? "pro" : "free",
}));
import { prisma } from "db";
import { stripeGet, verifyStripeSignature } from "@/lib/stripe";
import { POST } from "./route";

function request(type = "customer.subscription.updated", raw?: string) {
  return new Request("https://seo.nurovelle.de/api/billing/webhook", {
    method: "POST", body: raw ?? JSON.stringify({ type, data: {
      object: { id: "sub_test", customer: "cus_untrusted", status: "active" },
    } }),
  });
}

describe("subscription webhook reconciliation", () => {
  beforeEach(() => {
    vi.mocked(verifyStripeSignature).mockReturnValue(true);
    vi.mocked(stripeGet).mockResolvedValue({
      id: "sub_test", customer: "cus_current", status: "active",
      items: { data: [{ price: { id: "price_pro" } }] },
    });
    vi.mocked(prisma.workspace.updateMany).mockResolvedValue({ count: 1 });
  });
  afterEach(() => vi.resetAllMocks());
  it("uses the current subscription customer and price instead of stale event data", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(stripeGet).toHaveBeenCalledWith("subscriptions/sub_test");
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_current", OR: [{ stripeSubscriptionId: null }, { stripeSubscriptionId: "sub_test" }] },
      data: { plan: "pro", stripeSubscriptionId: "sub_test", stripePriceId: "price_pro" },
    });
  });
  it("does not revive canceled access when an older active event arrives", async () => {
    vi.mocked(stripeGet).mockResolvedValue({ id: "sub_test", customer: "cus_current", status: "canceled", items: { data: [] } });
    expect((await POST(request())).status).toBe(200);
    expect(prisma.workspace.updateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: "cus_current", stripeSubscriptionId: "sub_test" },
      data: { plan: "free", stripeSubscriptionId: null, stripePriceId: null },
    });
  });
  it("asks Stripe to retry when the current subscription cannot be retrieved", async () => {
    vi.mocked(stripeGet).mockRejectedValue(new Error("upstream unavailable"));
    expect((await POST(request())).status).toBe(503);
    expect(prisma.workspace.updateMany).not.toHaveBeenCalled();
  });
  it("rejects invalid signatures before accessing Stripe or the database", async () => {
    vi.mocked(verifyStripeSignature).mockReturnValue(false);
    expect((await POST(request())).status).toBe(400);
    expect(stripeGet).not.toHaveBeenCalled();
    expect(prisma.workspace.updateMany).not.toHaveBeenCalled();
  });
  it("rejects malformed signed payloads and ignores unrelated events", async () => {
    expect((await POST(request(undefined, "{"))).status).toBe(400);
    expect((await POST(request("invoice.created"))).status).toBe(200);
    expect(stripeGet).not.toHaveBeenCalled();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", () => ({ prisma: {
  membership: { findUnique: vi.fn() },
  workspace: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
} }));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/stripe", async (original) => ({
  ...await original<typeof import("@/lib/stripe")>(), stripeForm: vi.fn(),
}));

import { prisma } from "db";
import { getSession } from "@/lib/auth";
import { stripeForm } from "@/lib/stripe";
import { POST } from "./route";

function request() {
  return new Request("https://seo.nurovelle.de/api/billing/checkout", {
    method: "POST", body: JSON.stringify({ plan: "pro", returnTo: "/preise" }),
  });
}

describe("billing checkout", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "test-key");
    vi.stubEnv("STRIPE_PRICE_PRO", "price_pro");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://seo.nurovelle.de");
    vi.mocked(getSession).mockResolvedValue({ userId: "user", workspaceId: "workspace", user: { email: "owner@example.com" } } as Awaited<ReturnType<typeof getSession>>);
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "owner" } as never);
    vi.mocked(prisma.workspace.findUniqueOrThrow).mockResolvedValue({
      id: "workspace", name: "Test", stripeCustomerId: "cus_test", stripeSubscriptionId: null,
    } as never);
    vi.mocked(stripeForm).mockResolvedValue({ url: "https://billing.stripe.com/test" });
  });
  afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

  it("returns a product error without creating Stripe resources when configuration is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Zahlungen sind derzeit nicht verfügbar." });
    expect(stripeForm).not.toHaveBeenCalled();
  });
  it("does not create a customer when the requested price is missing", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    expect((await POST(request())).status).toBe(503);
    expect(stripeForm).not.toHaveBeenCalled();
  });
  it("sends subscribers to the portal even when new-checkout prices are unavailable", async () => {
    vi.stubEnv("STRIPE_PRICE_PRO", "");
    vi.mocked(prisma.workspace.findUniqueOrThrow).mockResolvedValue({
      id: "workspace", stripeCustomerId: "cus_test", stripeSubscriptionId: "sub_test",
    } as never);
    expect((await POST(request())).status).toBe(200);
    expect(stripeForm).toHaveBeenCalledWith("billing_portal/sessions", {
      customer: "cus_test", return_url: "https://seo.nurovelle.de/preise",
    });
  });
  it("blocks workspace members from buying subscriptions", async () => {
    vi.mocked(prisma.membership.findUnique).mockResolvedValue({ role: "member" } as never);
    expect((await POST(request())).status).toBe(403);
    expect(stripeForm).not.toHaveBeenCalled();
  });
});

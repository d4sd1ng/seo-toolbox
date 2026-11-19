import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("db", () => ({ prisma: {
  rateLimitBucket: { findUnique: vi.fn(async () => null) },
} }));

import { enforceToolRateLimit, publicToolStatus, isPlatformOwner } from "./rate-limit";

describe("tool tier access", () => {
  const request = new Request("https://seo.nurovelle.de/api/tools/keyword-check");

  beforeEach(() => {
    vi.stubEnv("RATE_LIMIT_IP_SECRET", "test-secret-with-at-least-32-characters");
    vi.stubEnv("TOOLBOX_OWNER_EMAILS", "owner@example.com");
  });
  afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

  it("hides and rejects Keyword-Check for Free users", async () => {
    expect(await publicToolStatus(request, "keyword_check", "free")).toMatchObject({ available: false, limit: 0 });
    expect((await enforceToolRateLimit(request, "keyword_check", { plan: "free" }))?.status).toBe(403);
  });

  it.each(["pro", "agency"] as const)("allows Keyword-Check for %s", async (plan) => {
    expect(await publicToolStatus(request, "keyword_check", plan)).toMatchObject({ available: true });
  });

  it.each(["free", "pro", "agency"] as const)("hides and rejects GSC for non-owner %s users", async (plan) => {
    expect(await publicToolStatus(request, "gsc_preview", plan, "member@example.com")).toMatchObject({ available: false });
    expect((await enforceToolRateLimit(request, "gsc_preview", { plan, ownerEmail: "member@example.com" }))?.status).toBe(403);
  });

  it("does not grant owner privileges from an unverified matching email", async () => {
    expect(isPlatformOwner("owner@example.com")).toBe(false);
    expect(isPlatformOwner("OWNER@example.com", false)).toBe(false);
    expect(await publicToolStatus(request, "gsc_preview", "free", "owner@example.com", false)).toMatchObject({ available: false });
    expect((await enforceToolRateLimit(request, "gsc_preview", { ownerEmail: "owner@example.com" }))?.status).toBe(403);
  });

  it("does not grant owner privileges to a verified email outside the allowlist", () => {
    expect(isPlatformOwner("member@example.com", true)).toBe(false);
  });

  it("allows the configured platform owner to use GSC without a quota", async () => {
    expect(await publicToolStatus(request, "gsc_preview", "free", "owner@example.com", true)).toMatchObject({ available: true, limit: null });
    expect(await enforceToolRateLimit(request, "gsc_preview", { plan: "free", ownerEmail: "owner@example.com", ownerEmailVerified: true })).toBeNull();
  });
});

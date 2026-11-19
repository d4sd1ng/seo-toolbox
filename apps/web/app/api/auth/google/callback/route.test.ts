import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  profile: { email: "owner@example.com", email_verified: true, name: "Owner" },
  user: { upsert: vi.fn() },
  workspace: { create: vi.fn() },
  membership: { create: vi.fn() },
  verifyIdToken: vi.fn(),
  getToken: vi.fn(),
}));
vi.mock("db", () => ({
  prisma: { user: mocks.user, workspace: mocks.workspace, membership: mocks.membership },
}));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  createSessionToken: vi.fn(async () => "test-token"),
  getSession: vi.fn(async () => null),
}));
vi.mock("@/lib/google-login", async (original) => ({
  ...(await original<typeof import("@/lib/google-login")>()),
  googleClient: () => ({ getToken: mocks.getToken, verifyIdToken: mocks.verifyIdToken }),
}));
import { createSessionToken, getSession } from "@/lib/auth";
import { GET } from "./route";
function request(state = "valid-state") {
  return new NextRequest(
    `https://seo.nurovelle.de/api/auth/google/callback?code=test&state=${state}`,
    {
      headers: { cookie: "seo_google_state=valid-state; seo_google_next=homepage" },
    },
  );
}

describe("Google email proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://seo.nurovelle.de");
    mocks.profile.email_verified = true;
    vi.mocked(getSession).mockResolvedValue(null);
    mocks.getToken.mockResolvedValue({ tokens: { id_token: "test-id-token" } });
    mocks.verifyIdToken.mockResolvedValue({ getPayload: () => mocks.profile });
    mocks.user.upsert.mockResolvedValue({
      id: "user",
      memberships: [{ workspaceId: "workspace" }],
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("uses the public origin for callback errors behind the proxy", async () => {
    const response = await GET(
      new NextRequest("https://0.0.0.0:3000/api/auth/google/callback?state=invalid&code=invalid"),
    );
    expect(new URL(response.headers.get("location")!).origin).toBe("https://seo.nurovelle.de");
  });
  it("uses the public origin for normal Google-login returns", async () => {
    const response = await GET(
      new NextRequest("https://0.0.0.0:3000/api/auth/google/callback?state=valid-state&code=test", {
        headers: { cookie: "seo_google_state=valid-state" },
      }),
    );
    expect(response.headers.get("location")).toBe("https://seo.nurovelle.de/");
  });
  it("creates a verified session only after Google token and email verification", async () => {
    const response = await GET(request());
    expect(mocks.verifyIdToken).toHaveBeenCalled();
    expect(createSessionToken).toHaveBeenCalledWith("user", "workspace", { emailVerified: true });
    expect(response.headers.get("location")).toBe(
      "https://nurovelle.de/homepage/detail_seo.html?owner=1",
    );
    expect(response.cookies.get("seo_session")?.value).toBe("test-token");
  });
  it("rejects an unverified Google email without creating or linking an account", async () => {
    mocks.profile.email_verified = false;
    const response = await GET(request());
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(mocks.user.upsert).not.toHaveBeenCalled();
    expect(createSessionToken).not.toHaveBeenCalled();
    expect(response.cookies.get("seo_session")).toBeUndefined();
  });
  it("does not automatically link a pre-registered password account by email", async () => {
    mocks.user.upsert.mockResolvedValue({
      id: "pre-registered",
      passwordHash: "attacker-chosen-password-hash",
      memberships: [{ workspaceId: "attacker-workspace" }],
    });
    const response = await GET(request());
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    expect(createSessionToken).not.toHaveBeenCalled();
    expect(response.cookies.get("seo_session")).toBeUndefined();
  });
  it("does not link a password account from a different authenticated account", async () => {
    mocks.user.upsert.mockResolvedValue({
      id: "target",
      passwordHash: "existing-hash",
      memberships: [],
    });
    vi.mocked(getSession).mockResolvedValue({ userId: "other" } as Awaited<
      ReturnType<typeof getSession>
    >);
    await GET(request());
    expect(createSessionToken).not.toHaveBeenCalled();
    expect(mocks.workspace.create).not.toHaveBeenCalled();
  });
  it("allows a password-account holder to start Google login from their own session", async () => {
    mocks.user.upsert.mockResolvedValue({
      id: "user",
      passwordHash: "existing-hash",
      memberships: [{ workspaceId: "workspace" }],
    });
    vi.mocked(getSession).mockResolvedValue({ userId: "user" } as Awaited<
      ReturnType<typeof getSession>
    >);
    const response = await GET(request());
    expect(createSessionToken).toHaveBeenCalledWith("user", "workspace", { emailVerified: true });
    expect(response.cookies.get("seo_session")?.value).toBe("test-token");
  });
  it("rejects an invalid OAuth state before exchanging tokens", async () => {
    await GET(request("attacker-state"));
    expect(mocks.getToken).not.toHaveBeenCalled();
    expect(createSessionToken).not.toHaveBeenCalled();
  });
});

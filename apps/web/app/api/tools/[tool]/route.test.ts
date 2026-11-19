import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  prisma: {
    workspace: { findUnique: vi.fn() },
    project: { findMany: vi.fn(), findFirst: vi.fn() },
    rateLimitBucket: { findUnique: vi.fn(async () => null) },
  },
  loadGscTokens: vi.fn(),
  querySearchAnalytics: vi.fn(),
}));
vi.mock("db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/auth", () => ({ getSession: mocks.getSession }));
vi.mock("@/lib/public-tools", () => ({
  audit: vi.fn(),
  crawlDemo: vi.fn(),
  keywordCheck: vi.fn(),
  robotsSitemap: vi.fn(),
  safeTarget: vi.fn(),
}));
vi.mock("module-gsc", () => ({
  loadGscTokens: mocks.loadGscTokens,
  querySearchAnalytics: mocks.querySearchAnalytics,
}));
import { GET, POST } from "./route";
const params = { params: Promise.resolve({ tool: "gsc-preview" }) };
const url = "https://seo.nurovelle.de/api/tools/gsc-preview?owner=1&emailVerified=true";
function session(emailVerified: boolean) {
  return {
    userId: "user",
    workspaceId: "workspace",
    emailVerified,
    user: { email: "owner@example.com" },
  };
}
describe("Owner GSC endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RATE_LIMIT_IP_SECRET", "test-secret-with-at-least-32-characters");
    vi.stubEnv("TOOLBOX_OWNER_EMAILS", "owner@example.com");
    mocks.getSession.mockResolvedValue(session(false));
    mocks.prisma.workspace.findUnique.mockResolvedValue({ plan: "free" });
    mocks.prisma.project.findMany.mockResolvedValue([
      { id: "project", name: "Test", gscSiteUrl: "sc-domain:example.com" },
    ]);
    mocks.prisma.project.findFirst.mockResolvedValue({ gscSiteUrl: "sc-domain:example.com" });
    mocks.loadGscTokens.mockResolvedValue({ accessToken: "test" });
    mocks.querySearchAnalytics.mockResolvedValue([]);
  });
  afterEach(() => vi.unstubAllEnvs());
  it("hides GSC for an unverified session even if the email is allowlisted", async () => {
    const response = await GET(new Request(url), params);
    expect(await response.json()).toMatchObject({ available: false, projects: [] });
    expect(mocks.prisma.project.findMany).not.toHaveBeenCalled();
  });
  it("does not trust owner or email-verification claims in request input", async () => {
    const response = await POST(
      new Request(url, {
        method: "POST",
        body: JSON.stringify({ projectId: "project", owner: true, ownerEmailVerified: true }),
      }),
      params,
    );
    expect(response.status).toBe(403);
    expect(mocks.loadGscTokens).not.toHaveBeenCalled();
    expect(mocks.querySearchAnalytics).not.toHaveBeenCalled();
  });
  it("allows a verified owner and retains the workspace boundary", async () => {
    mocks.getSession.mockResolvedValue(session(true));
    const response = await POST(
      new Request(url, { method: "POST", body: JSON.stringify({ projectId: "project" }) }),
      params,
    );
    expect(response.status).toBe(200);
    expect(mocks.prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: "project", workspaceId: "workspace" },
      select: { gscSiteUrl: true },
    });
    expect(mocks.querySearchAnalytics).toHaveBeenCalledOnce();
  });
});

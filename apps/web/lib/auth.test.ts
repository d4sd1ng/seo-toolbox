import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  cookie: vi.fn(),
  membership: { findUnique: vi.fn() },
  session: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.cookie }) }));
vi.mock("db", () => ({ prisma: { membership: mocks.membership, session: mocks.session } }));
import { createSessionToken, getSession } from "./auth";

describe("verified email is bound to the server session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.membership.findUnique.mockResolvedValue({ role: "owner" });
  });
  it("creates ordinary password and registration sessions without verified email proof", async () => {
    await createSessionToken("user", "workspace");
    expect(mocks.session.create.mock.calls[0][0].data.emailVerified).toBe(false);
  });
  it("stores the proof for a verified Google login", async () => {
    await createSessionToken("user", "workspace", { emailVerified: true });
    expect(mocks.session.create.mock.calls[0][0].data.emailVerified).toBe(true);
  });
  it("returns only the database proof when loading a session", async () => {
    mocks.cookie.mockReturnValue({ value: "valid-token" });
    const row = {
      id: "session",
      userId: "user",
      workspaceId: "workspace",
      expiresAt: new Date(Date.now() + 14 * 86400000),
      lastSeenAt: new Date(),
      emailVerified: false,
      user: { id: "user", email: "owner@example.com", name: "Owner" },
    };
    mocks.session.findUnique.mockResolvedValue(row);
    expect(await getSession()).toMatchObject({ emailVerified: false });
    mocks.session.findUnique.mockResolvedValue({ ...row, emailVerified: true });
    expect(await getSession()).toMatchObject({ emailVerified: true });
  });
});

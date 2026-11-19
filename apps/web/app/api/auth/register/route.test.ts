import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  workspace: { create: vi.fn() },
  membership: { create: vi.fn() },
}));
vi.mock("db", () => ({ prisma: db }));
vi.mock("@/lib/rate-limit", () => ({ enforceToolRateLimit: vi.fn(async () => null) }));
vi.mock("@/lib/auth", async (original) => ({
  ...(await original<typeof import("@/lib/auth")>()),
  createSessionToken: vi.fn(async () => "test-token"),
}));
import { createSessionToken } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { POST } from "./route";
import { POST as aliasPOST } from "@/app/app/api/auth/register/route";

function request(form: boolean) {
  const fields = { email: "  Owner@Example.com  ", password: "new-password-123", name: "Test" };
  return new Request("https://seo.nurovelle.de/api/auth/register", {
    method: "POST",
    headers: { "content-type": form ? "application/x-www-form-urlencoded" : "application/json" },
    body: form ? new URLSearchParams(fields) : JSON.stringify(fields),
  });
}

describe.each([
  ["canonical", POST],
  ["legacy alias", aliasPOST],
] as const)("registration %s", (_, register) => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockResolvedValue({ id: "new-user" });
    db.user.update.mockResolvedValue({ id: "existing-user", name: "Existing" });
    db.workspace.create.mockResolvedValue({ id: "workspace" });
    db.membership.create.mockResolvedValue({});
  });
  it.each([false, true])(
    "does not claim a Google-only or invited account, form=%s",
    async (form) => {
      db.user.findUnique.mockResolvedValue({
        id: "existing-user",
        email: "owner@example.com",
        passwordHash: null,
      });
      const response = await register(request(form));
      expect(createSessionToken).not.toHaveBeenCalled();
      expect(
        form
          ? new URL(response.headers.get("location")!).searchParams.get("error")
          : (await response.json()).error,
      ).toContain("Konto existiert bereits");
      expect(db.user.update).not.toHaveBeenCalled();
      expect(db.user.create).not.toHaveBeenCalled();
      expect(db.workspace.create).not.toHaveBeenCalled();
      expect(createSessionToken).not.toHaveBeenCalled();
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: "owner@example.com" } });
    },
  );
  it("continues rejecting accounts that already have a password", async () => {
    db.user.findUnique.mockResolvedValue({ id: "existing-user", passwordHash: "existing-hash" });
    expect((await register(request(false))).status).toBe(409);
    expect(createSessionToken).not.toHaveBeenCalled();
  });
  it("rejects a concurrent duplicate registration without creating another session", async () => {
    db.user.create.mockRejectedValueOnce({ code: "P2002" });
    expect((await register(request(false))).status).toBe(409);
    expect(createSessionToken).not.toHaveBeenCalled();
    expect(db.workspace.create).not.toHaveBeenCalled();
  });
  it("registers a new user with a hashed password and a free workspace", async () => {
    expect((await register(request(false))).status).toBe(200);
    const saved = db.user.create.mock.calls[0][0].data;
    expect(saved.email).toBe("owner@example.com");
    expect(verifyPassword("new-password-123", saved.passwordHash)).toBe(true);
    expect(db.workspace.create.mock.calls[0][0].data.plan).toBe("free");
    expect(createSessionToken).toHaveBeenCalledWith("new-user", "workspace");
  });
});

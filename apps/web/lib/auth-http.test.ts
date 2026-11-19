import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth", () => ({
  attachSessionCookie: (response: NextResponse, token: string) => {
    response.cookies.set("seo_session", token);
    return response;
  },
}));
import { authError, authOk } from "./auth-http";
const request = new Request("https://0.0.0.0:3000/api/auth/login");
describe("authentication redirects behind the production proxy", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://seo.nurovelle.de"));
  afterEach(() => vi.unstubAllEnvs());
  it("sends form errors to the configured public login page", () => {
    const response = authError(false, request, "Test error");
    const url = new URL(response.headers.get("location")!);
    expect(url.origin).toBe("https://seo.nurovelle.de");
    expect(url.pathname).toBe("/login");
  });
  it("retains a valid return path and sets the session cookie", () => {
    const response = authOk(false, request, "test-token", "/toolbox/embed?inline=1");
    expect(response.headers.get("location")).toBe(
      "https://seo.nurovelle.de/toolbox/embed?inline=1",
    );
    expect(response.cookies.get("seo_session")?.value).toBe("test-token");
  });
  it.each([
    "//evil.example",
    "/\\evil.example",
    "/\n/evil.example",
    "https://evil.example/",
    "javascript:alert(1)",
  ])("keeps unsafe return path %s on the public app origin", (next) => {
    const response = authOk(false, request, "test-token", next);
    expect(response.headers.get("location")).toBe("https://seo.nurovelle.de/");
  });
});

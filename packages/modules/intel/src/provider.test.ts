import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("core", () => ({ decryptJson: vi.fn() }));
vi.mock("db", () => ({ prisma: { integration: { findUnique: vi.fn() } } }));

import { DataForSeoRateLimitError, dfsPost, fetchOrganicSerp } from "./provider";

describe("DataForSEO rate-limit fallback", () => {
  beforeEach(() => {
    vi.stubEnv("DATAFORSEO_LOGIN", "login");
    vi.stubEnv("DATAFORSEO_PASSWORD", "password");
    vi.stubEnv("SERPER_API_KEY", "serper-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("recognizes rate limits in successful HTTP responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({
      status_code: 20000,
      tasks: [{ status_code: 40202 }],
    })));

    await expect(dfsPost("/v3/example", [{}])).rejects.toBeInstanceOf(DataForSeoRateLimitError);
  });

  it("uses Serper after a DataForSEO limit, while keeping DataForSEO first", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ status_code: 40202, tasks: [] }))
      .mockResolvedValueOnce(Response.json({
        organic: [{ title: "Result", link: "https://example.com/page", position: 1 }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    const results = await fetchOrganicSerp("seo");

    expect(results).toEqual([{
      position: 1,
      url: "https://example.com/page",
      title: "Result",
      domain: "example.com",
      snippet: undefined,
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain("api.dataforseo.com");
    expect(fetchMock.mock.calls[1][0]).toContain("google.serper.dev");
  });

  it("does not switch providers for unrelated DataForSEO errors", async () => {
    const fetchMock = vi.fn(async () => Response.json(
      { status_message: "Invalid request" },
      { status: 400 },
    ));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchOrganicSerp("seo")).rejects.toThrow("Invalid request");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

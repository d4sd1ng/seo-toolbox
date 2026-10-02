import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("module-onpage", () => ({ analyzeHtml: vi.fn() }));
vi.mock("module-intel/public-provider", () => ({
  DataForSeoRateLimitError: class DataForSeoRateLimitError extends Error {},
  dfsPost: vi.fn(),
  hasDataForSeo: vi.fn(() => true),
  hasSerper: vi.fn(async () => true),
  serperAutocomplete: vi.fn(async () => ["seo check"]),
}));

import { dfsPost, DataForSeoRateLimitError, serperAutocomplete } from "module-intel/public-provider";
import { keywordCheck } from "./public-tools";

describe("public keyword check", () => {
  afterEach(() => vi.clearAllMocks());

  it("sends the required DataForSEO keywords array", async () => {
    vi.mocked(dfsPost).mockResolvedValue({ tasks: [{ result: [{ items: [{ keyword: "seo analyse" }] }] }] });

    await expect(keywordCheck("seo")).resolves.toEqual({
      seed: "seo", provider: "dataforseo", suggestions: ["seo", "seo analyse"],
    });
    expect(dfsPost).toHaveBeenCalledWith("/v3/dataforseo_labs/google/keyword_ideas/live", [
      { keywords: ["seo"], location_name: "Germany", language_code: "de", limit: 10 },
    ]);
    expect(serperAutocomplete).not.toHaveBeenCalled();
  });

  it("uses Serper only after a DataForSEO rate limit", async () => {
    vi.mocked(dfsPost).mockRejectedValue(new DataForSeoRateLimitError());

    await expect(keywordCheck("seo")).resolves.toEqual({
      seed: "seo", provider: "serper", suggestions: ["seo", "seo check"],
    });
    expect(serperAutocomplete).toHaveBeenCalledWith("seo", undefined, { strict: true });
  });
});

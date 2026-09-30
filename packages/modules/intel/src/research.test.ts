import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("core", () => ({ LimitError: class LimitError extends Error {} }));
vi.mock("db", () => ({
  prisma: {
    project: { findUniqueOrThrow: vi.fn(async () => ({ id: "project", defaultLocale: "de", defaultCountry: "DE" })) },
    job: { update: vi.fn(async () => ({})) },
    keyword: { count: vi.fn(async () => 0), upsert: vi.fn(async () => ({})) },
  },
  workspacePlanCaps: vi.fn(async () => ({ keywordIdeas: 10, keywordsTracked: 50, plan: "free" })),
}));
vi.mock("./provider", () => ({
  DataForSeoRateLimitError: class DataForSeoRateLimitError extends Error {},
  dfsPost: vi.fn(),
  hasDataForSeo: vi.fn(() => true),
  serperAutocomplete: vi.fn(async () => ["seo tools"]),
}));

import { prisma } from "db";
import { DataForSeoRateLimitError, dfsPost, serperAutocomplete } from "./provider";
import { runKeywordExpand } from "./research";

describe("keyword research provider fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses Serper suggestions and skips DataForSEO volume after a rate limit", async () => {
    vi.mocked(dfsPost).mockRejectedValueOnce(new DataForSeoRateLimitError());

    const result = await runKeywordExpand({
      projectId: "project", workspaceId: "workspace", jobId: "job", seed: "seo",
    });

    expect(result.created).toBe(2);
    expect(dfsPost).toHaveBeenCalledTimes(1);
    expect(serperAutocomplete).toHaveBeenCalledWith("seo", "workspace", { strict: true });
    expect(prisma.keyword.upsert).toHaveBeenCalledTimes(2);
  });

  it("switches to Serper when the volume request is rate limited", async () => {
    vi.mocked(dfsPost)
      .mockResolvedValueOnce({ tasks: [{ result: [{ items: [{ keyword: "seo audit" }] }] }] })
      .mockRejectedValueOnce(new DataForSeoRateLimitError());

    const result = await runKeywordExpand({
      projectId: "project", workspaceId: "workspace", jobId: "job", seed: "seo",
    });

    expect(result.created).toBe(3);
    expect(serperAutocomplete).toHaveBeenCalledWith("seo", "workspace", { strict: true });
    expect(prisma.keyword.upsert).toHaveBeenCalledTimes(3);
  });
});

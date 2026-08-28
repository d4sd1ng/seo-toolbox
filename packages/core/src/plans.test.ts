import { describe, expect, it } from "vitest";
import { clampToCap, dailyCapForJob, planCaps, quotaKeyForJob } from "./plans";

describe("plan caps", () => {
  it("defaults unknown plans to free", () => {
    expect(planCaps(undefined).renderSlots).toBe(20);
    expect(planCaps("hobby").crawlMaxUrls).toBe(200);
  });

  it("maps jobs to daily caps", () => {
    const caps = planCaps("pro");
    expect(dailyCapForJob("site_crawl", caps)).toBe(caps.crawlsPerDay);
    expect(dailyCapForJob("serp_snapshot", caps)).toBe(caps.researchPerDay);
    expect(dailyCapForJob("unknown", caps)).toBeNull();
  });

  it("maps jobs to stored quota keys", () => {
    expect(quotaKeyForJob("onpage_audit")).toBe("onpagePerDay");
    expect(quotaKeyForJob("keyword_expand")).toBe("researchPerDay");
    expect(quotaKeyForJob("serp_snapshot")).toBe("researchPerDay");
  });

  it("clamps requested values to the plan cap", () => {
    expect(clampToCap(5000, 200)).toBe(200);
    expect(clampToCap(undefined, 80)).toBe(80);
    expect(clampToCap(0, 80)).toBe(1);
  });
});

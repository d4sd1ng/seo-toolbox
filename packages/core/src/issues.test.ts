import { describe, expect, it } from "vitest";
import { priorityScore } from "./issues";

describe("priorityScore", () => {
  it("ranks critical/easy higher than low/hard", () => {
    const hot = priorityScore({
      severity: "critical",
      effort: "xs",
      impact: 1,
      confidence: 1,
    });
    const cold = priorityScore({
      severity: "low",
      effort: "l",
      impact: 0.2,
      confidence: 0.5,
    });
    expect(hot).toBeGreaterThan(cold);
  });

  it("clamps impact and confidence", () => {
    const a = priorityScore({
      severity: "high",
      effort: "s",
      impact: 2,
      confidence: 2,
    });
    const b = priorityScore({
      severity: "high",
      effort: "s",
      impact: 1,
      confidence: 1,
    });
    expect(a).toBe(b);
  });
});

import type { Effort, Severity } from "./types";

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

const EFFORT_WEIGHT: Record<Effort, number> = {
  xs: 1,
  s: 1.4,
  m: 2.2,
  l: 3.5,
};

export function priorityScore(input: {
  severity: Severity;
  effort: Effort;
  impact: number; // 0-1
  confidence: number; // 0-1
}): number {
  const impact = clamp(input.impact, 0, 1);
  const confidence = clamp(input.confidence, 0, 1);
  return (
    (SEVERITY_WEIGHT[input.severity] * impact * confidence) /
    EFFORT_WEIGHT[input.effort]
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

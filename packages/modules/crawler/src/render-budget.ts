export const RENDER_BUDGET = {
  defaultSlots: 80,
  capSlots: 150,
  defaultWallClockMs: 8 * 60_000,
  capWallClockMs: 15 * 60_000,
  timeoutMs: 15_000,
  waitMs: 4_000,
  circuitErrors: 3,
} as const;

export function clampRenderBudget(requested?: number, planCap?: number) {
  const cap = planCap ?? RENDER_BUDGET.capSlots;
  const value = requested ?? Math.min(RENDER_BUDGET.defaultSlots, cap);
  return Math.min(cap, Math.max(0, value));
}

export function clampWallClock(requested?: number) {
  const value = requested ?? RENDER_BUDGET.defaultWallClockMs;
  return Math.min(RENDER_BUDGET.capWallClockMs, Math.max(30_000, value));
}

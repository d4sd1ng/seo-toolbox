import { clampRenderBudget, clampWallClock, RENDER_BUDGET } from "./render-budget";

export type RenderStopReason =
  | "ok"
  | "budget"
  | "wallclock"
  | "circuit"
  | "disabled";

export type RenderMonitorSnapshot = {
  httpFetched: number;
  httpFailed: number;
  renderAttempted: number;
  renderSucceeded: number;
  renderFailed: number;
  renderSkippedHeuristic: number;
  renderBudget: number;
  renderBudgetHit: boolean;
  renderAvgMs: number;
  renderP95Ms: number;
  renderWallClockMs: number;
  rssMb: number;
  heapMb: number;
  stopReason: RenderStopReason;
  circuitOpen: boolean;
};

export class RenderMonitor {
  private readonly startedAt = Date.now();
  private readonly renderDurations: number[] = [];
  private consecutiveRenderErrors = 0;
  private stopReason: RenderStopReason;
  private httpFetched = 0;
  private httpFailed = 0;
  private renderAttempted = 0;
  private renderSucceeded = 0;
  private renderFailed = 0;
  private renderSkippedHeuristic = 0;

  constructor(
    private readonly opts: {
      enabled: boolean;
      renderBudget?: number;
      wallClockMs?: number;
    },
  ) {
    this.stopReason = opts.enabled ? "ok" : "disabled";
  }

  get budget() {
    return clampRenderBudget(this.opts.renderBudget);
  }

  get wallClockMs() {
    return clampWallClock(this.opts.wallClockMs);
  }

  recordHttp(ok: boolean) {
    this.httpFetched += 1;
    if (!ok) this.httpFailed += 1;
  }

  recordSkippedHeuristic() {
    this.renderSkippedHeuristic += 1;
  }

  canRender(): { ok: boolean; reason: RenderStopReason } {
    if (!this.opts.enabled) return { ok: false, reason: "disabled" };
    if (this.consecutiveRenderErrors >= RENDER_BUDGET.circuitErrors) {
      this.stopReason = "circuit";
      return { ok: false, reason: "circuit" };
    }
    if (this.renderAttempted >= this.budget) {
      this.stopReason = "budget";
      return { ok: false, reason: "budget" };
    }
    if (Date.now() - this.startedAt >= this.wallClockMs) {
      this.stopReason = "wallclock";
      return { ok: false, reason: "wallclock" };
    }
    return { ok: true, reason: "ok" };
  }

  startRender() {
    this.renderAttempted += 1;
    return Date.now();
  }

  finishRender(startedAt: number, ok: boolean) {
    this.renderDurations.push(Date.now() - startedAt);
    if (ok) {
      this.renderSucceeded += 1;
      this.consecutiveRenderErrors = 0;
      return;
    }
    this.renderFailed += 1;
    this.consecutiveRenderErrors += 1;
    if (this.consecutiveRenderErrors >= RENDER_BUDGET.circuitErrors) {
      this.stopReason = "circuit";
    }
  }

  snapshot(): RenderMonitorSnapshot {
    const mem = process.memoryUsage();
    const sorted = [...this.renderDurations].sort((a, b) => a - b);
    const avg =
      sorted.length === 0 ? 0 : Math.round(sorted.reduce((s, n) => s + n, 0) / sorted.length);
    const p95 =
      sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];

    return {
      httpFetched: this.httpFetched,
      httpFailed: this.httpFailed,
      renderAttempted: this.renderAttempted,
      renderSucceeded: this.renderSucceeded,
      renderFailed: this.renderFailed,
      renderSkippedHeuristic: this.renderSkippedHeuristic,
      renderBudget: this.budget,
      renderBudgetHit: this.renderAttempted >= this.budget,
      renderAvgMs: avg,
      renderP95Ms: p95,
      renderWallClockMs: Date.now() - this.startedAt,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapMb: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      stopReason: this.stopReason,
      circuitOpen: this.stopReason === "circuit",
    };
  }

  summaryLine() {
    const s = this.snapshot();
    return [
      `http ${s.httpFetched}/${s.httpFailed} fail`,
      `render ${s.renderSucceeded}/${s.renderAttempted} of ${s.renderBudget}`,
      `avg ${s.renderAvgMs}ms`,
      `rss ${s.rssMb}MB`,
      s.stopReason !== "ok" && s.stopReason !== "disabled" ? s.stopReason : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
}

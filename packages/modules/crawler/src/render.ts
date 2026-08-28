import { RENDER_BUDGET } from "./render-budget";
import { acquirePageSlot, getBrowserContext, releasePageSlot } from "./browser-pool";

const BLOCKED_TYPES = new Set(["image", "media", "font"]);
const BLOCKED_HOST =
  /google-analytics|googletagmanager|doubleclick|hotjar|facebook\.net|adsystem|scorecardresearch/i;

export type RenderOutcome = {
  html: string;
  finalUrl: string;
  renderMs: number;
  error?: string;
};

export async function renderUrl(url: string): Promise<RenderOutcome> {
  const started = Date.now();
  await acquirePageSlot();
  let page: Awaited<ReturnType<Awaited<ReturnType<typeof getBrowserContext>>["newPage"]>> | null =
    null;
  try {
    const ctx = await getBrowserContext();
    page = await ctx.newPage();
    await page.route("**/*", (route) => {
      const req = route.request();
      const type = req.resourceType();
      if (BLOCKED_TYPES.has(type) || BLOCKED_HOST.test(req.url())) {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: RENDER_BUDGET.timeoutMs,
    });
    await page.waitForFunction(
      (minChars) => (document.body?.innerText?.trim().length ?? 0) >= minChars,
      80,
      { timeout: RENDER_BUDGET.waitMs },
    ).catch(() => undefined);

    const html = await page.content();
    return {
      html,
      finalUrl: page.url() || url,
      renderMs: Date.now() - started,
    };
  } catch (error) {
    return {
      html: "",
      finalUrl: url,
      renderMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Render fehlgeschlagen",
    };
  } finally {
    await page?.close().catch(() => undefined);
    releasePageSlot();
  }
}

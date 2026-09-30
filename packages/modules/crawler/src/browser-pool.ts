import { CRAWLER_UA } from "./user-agent";

type BrowserLike = {
  isConnected: () => boolean;
  newContext: (opts: Record<string, unknown>) => Promise<ContextLike>;
  close: () => Promise<void>;
};

type ContextLike = {
  newPage: () => Promise<PageLike>;
  close: () => Promise<void>;
};

type PageLike = {
  route: (pattern: string, handler: (route: RouteLike) => unknown) => Promise<void>;
  goto: (url: string, opts: Record<string, unknown>) => Promise<{ url: () => string } | null>;
  content: () => Promise<string>;
  close: () => Promise<void>;
};

type RouteLike = {
  request: () => { resourceType: () => string; url: () => string };
  abort: () => Promise<void>;
  continue: () => Promise<void>;
};

let browser: BrowserLike | null = null;
let context: ContextLike | null = null;
let launching: Promise<BrowserLike> | null = null;
let inFlightPages = 0;
const MAX_PAGES = 2;
const waiters: Array<() => void> = [];

async function launchBrowser() {
  const mod = (await import("playwright")) as {
    chromium: { launch: (opts: Record<string, unknown>) => Promise<BrowserLike> };
  };
  return mod.chromium.launch({
    headless: true,
    args: ["--disable-dev-shm-usage", "--no-sandbox"],
  });
}

export async function getBrowserContext() {
  if (!browser || !browser.isConnected()) {
    launching ??= launchBrowser();
    browser = await launching;
    launching = null;
    context = await browser.newContext({
      userAgent: CRAWLER_UA,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
    });
  }
  if (!context) {
    context = await browser.newContext({
      userAgent: CRAWLER_UA,
      javaScriptEnabled: true,
      ignoreHTTPSErrors: true,
    });
  }
  return context;
}

export async function acquirePageSlot() {
  if (inFlightPages >= MAX_PAGES) {
    await new Promise<void>((resolve) => waiters.push(resolve));
  }
  inFlightPages += 1;
}

export function releasePageSlot() {
  inFlightPages = Math.max(0, inFlightPages - 1);
  const next = waiters.shift();
  if (next) next();
}

export async function closeBrowser() {
  try {
    await context?.close();
    await browser?.close();
  } catch {
    /* ignore */
  }
  context = null;
  browser = null;
  launching = null;
  inFlightPages = 0;
  waiters.length = 0;
}

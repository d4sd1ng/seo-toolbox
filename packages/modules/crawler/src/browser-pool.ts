import type { Browser, BrowserContext } from "playwright";
import { CRAWLER_UA } from "./user-agent";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
let launching: Promise<Browser> | null = null;
let inFlightPages = 0;
const MAX_PAGES = 2;
const waiters: Array<() => void> = [];

async function launchBrowser() {
  const { chromium } = await import("playwright");
  return chromium.launch({
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

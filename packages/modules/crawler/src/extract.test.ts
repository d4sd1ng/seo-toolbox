import { describe, expect, it } from "vitest";
import { extractPage, isInternal, shouldSkipUrl } from "./extract";

describe("extractPage", () => {
  it("reads title, h1, canonical and internal links", () => {
    const html = `
      <html><head>
        <title>Start</title>
        <meta name="description" content="Hallo" />
        <link rel="canonical" href="/home" />
      </head>
      <body>
        <h1>Willkommen</h1>
        <p>${"wort ".repeat(40)}</p>
        <a href="/about">About</a>
        <a href="https://other.de/x">extern</a>
        <a href="/img/logo.png">asset</a>
      </body></html>
    `;
    const page = extractPage({
      baseUrl: "https://example.de/",
      html,
      includeSubdomains: false,
      primaryHost: "example.de",
    });
    expect(page.title).toBe("Start");
    expect(page.h1).toBe("Willkommen");
    expect(page.h1Count).toBe(1);
    expect(page.canonicalUrl).toBe("https://example.de/home");
    expect(page.internalOut).toContain("https://example.de/about");
    expect(page.externalOutCount).toBe(1);
    expect(page.wordCount).toBeGreaterThan(30);
  });
});

describe("url guards", () => {
  it("skips binary extensions", () => {
    expect(shouldSkipUrl("https://example.de/a.pdf")).toBe(true);
    expect(shouldSkipUrl("https://example.de/page")).toBe(false);
  });

  it("treats www as same host", () => {
    expect(isInternal("https://www.example.de/a", "example.de", false)).toBe(true);
    expect(isInternal("https://shop.example.de/a", "example.de", false)).toBe(false);
    expect(isInternal("https://shop.example.de/a", "example.de", true)).toBe(true);
  });
});

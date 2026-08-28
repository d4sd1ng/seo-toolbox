import { describe, expect, it } from "vitest";
import { shouldRender } from "./should-render";

describe("shouldRender", () => {
  it("renders the seed", () => {
    expect(shouldRender({ status: 200, html: "<p>viel text ".repeat(40), contentType: "text/html", isSeed: true }).render).toBe(true);
  });

  it("skips non-200", () => {
    expect(shouldRender({ status: 404, html: "", contentType: "text/html", isSeed: false }).render).toBe(false);
  });

  it("renders thin app shells", () => {
    const html = `<div id="__next"></div><script></script>${"<script></script>".repeat(8)}`;
    expect(shouldRender({ status: 200, html, contentType: "text/html", isSeed: false }).reason).toMatch(/thin|app_shell|script/);
  });

  it("keeps rich HTML on HTTP", () => {
    const html = `<title>Artikel</title><p>${"inhalt ".repeat(120)}</p>`;
    expect(shouldRender({ status: 200, html, contentType: "text/html", isSeed: false })).toEqual({
      render: false,
      reason: "html_sufficient",
    });
  });
});

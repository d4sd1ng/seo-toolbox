import { load } from "cheerio";
import type { Effort, Severity } from "core";
import { priorityScore } from "core";

export interface OnPageFinding {
  type: string;
  title: string;
  description: string;
  recommendation: string;
  severity: Severity;
  effort: Effort;
  priorityScore: number;
  evidence: Record<string, unknown>;
}

export interface OnPageMetrics {
  title: string | null;
  titleLength: number;
  metaDescription: string | null;
  metaLength: number;
  h1: string | null;
  h1Count: number;
  headingOutline: string[];
  canonicalUrl: string | null;
  robots: string[];
  images: number;
  imagesMissingAlt: number;
  wordCount: number;
  hasViewport: boolean;
  isHttps: boolean;
  schemaTypes: string[];
  htmlSizeBytes: number;
}

export interface OnPageAnalysis {
  score: number;
  metrics: OnPageMetrics;
  findings: OnPageFinding[];
  indexable: boolean;
  indexabilityReason: string | null;
}

const TITLE_MIN = 30;
const TITLE_MAX = 60;
const META_MIN = 70;
const META_MAX = 160;
const THIN_WORDS = 150;

export function analyzeHtml(input: {
  url: string;
  html: string;
  finalUrl: string;
  status: number;
}): OnPageAnalysis {
  const $ = load(input.html);
  const title = $("title").first().text().trim() || null;
  const metaDescription =
    $('meta[name="description"]').attr("content")?.trim() || null;
  const h1s = $("h1")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
  const canonicalRaw = $('link[rel="canonical"]').attr("href") ?? null;
  const canonicalUrl = resolveUrl(input.finalUrl, canonicalRaw);
  const robots = parseRobots(
    $('meta[name="robots"]').attr("content") ??
      $('meta[name="googlebot"]').attr("content"),
  );
  const images = $("img").length;
  const imagesMissingAlt = $("img").filter((_, el) => !$(el).attr("alt")?.trim()).length;
  const headingOutline = $("h1,h2,h3")
    .map((_, el) => `${el.tagName.toUpperCase()}: ${$(el).text().trim()}`)
    .get()
    .filter((line) => line.length > 4)
    .slice(0, 40);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const wordCount = text ? text.split(" ").length : 0;
  const schemaTypes = $('[type="application/ld+json"]')
    .map((_, el) => extractSchemaTypes($(el).text()))
    .get()
    .flat();

  const metrics: OnPageMetrics = {
    title,
    titleLength: title?.length ?? 0,
    metaDescription,
    metaLength: metaDescription?.length ?? 0,
    h1: h1s[0] ?? null,
    h1Count: h1s.length,
    headingOutline,
    canonicalUrl,
    robots,
    images,
    imagesMissingAlt,
    wordCount,
    hasViewport: Boolean($('meta[name="viewport"]').attr("content")),
    isHttps: input.finalUrl.startsWith("https:"),
    schemaTypes: [...new Set(schemaTypes)],
    htmlSizeBytes: Buffer.byteLength(input.html),
  };

  const noindex = robots.includes("noindex");
  const indexable = input.status < 400 && !noindex;
  const indexabilityReason = !indexable
    ? noindex
      ? "noindex"
      : `http_${input.status}`
    : null;

  const findings: OnPageFinding[] = [];
  const add = (
    type: string,
    titleText: string,
    description: string,
    recommendation: string,
    severity: Severity,
    effort: Effort,
    impact: number,
    evidence: Record<string, unknown>,
  ) => {
    findings.push({
      type,
      title: titleText,
      description,
      recommendation,
      severity,
      effort,
      priorityScore: priorityScore({ severity, effort, impact, confidence: 0.85 }),
      evidence,
    });
  };

  if (!title) {
    add("missing_title", "Title fehlt", "Die Seite hat kein Title-Tag.", "Title mit Hauptkeyword und Nutzenversprechen setzen (ca. 50–60 Zeichen).", "critical", "xs", 0.95, {});
  } else if (metrics.titleLength < TITLE_MIN) {
    add("title_too_short", "Title zu kurz", `Nur ${metrics.titleLength} Zeichen.`, "Title auf 50–60 Zeichen erweitern.", "medium", "xs", 0.55, { title });
  } else if (metrics.titleLength > TITLE_MAX) {
    add("title_too_long", "Title zu lang", `${metrics.titleLength} Zeichen – droht in der SERP abgeschnitten zu werden.`, "Auf unter 60 Zeichen kürzen, Keyword nach vorn.", "medium", "xs", 0.45, { title });
  }

  if (!metaDescription) {
    add("missing_meta_description", "Meta Description fehlt", "Kein description-Tag gefunden.", "Beschreibung mit Nutzen + CTA, 70–160 Zeichen.", "high", "xs", 0.6, {});
  } else if (metrics.metaLength < META_MIN || metrics.metaLength > META_MAX) {
    add("meta_length", "Meta Description-Länge", `${metrics.metaLength} Zeichen liegen außerhalb von ${META_MIN}–${META_MAX}.`, "Auf 70–160 Zeichen bringen.", "low", "xs", 0.3, { metaDescription });
  }

  if (h1s.length === 0) {
    add("missing_h1", "H1 fehlt", "Keine H1 auf der Seite.", "Eine klare H1 setzen, die zum Title passt.", "high", "xs", 0.7, {});
  } else if (h1s.length > 1) {
    add("multiple_h1", "Mehrere H1", `${h1s.length} H1-Überschriften gefunden.`, "Auf eine H1 reduzieren.", "low", "s", 0.25, { h1s });
  }

  if (!indexable) {
    add("not_indexable", "Seite nicht indexierbar", indexabilityReason ?? "unbekannt", "noindex entfernen oder Statuscode beheben, falls die URL ranken soll.", "critical", "s", 0.95, { status: input.status, robots });
  }

  if (canonicalUrl && stripTrailing(canonicalUrl) !== stripTrailing(input.finalUrl)) {
    add("canonical_mismatch", "Canonical zeigt weg", `Canonical: ${canonicalUrl}`, "Prüfen, ob das Absicht ist. Sonst Self-Canonical setzen.", "high", "s", 0.65, { canonicalUrl, finalUrl: input.finalUrl });
  }

  if (imagesMissingAlt > 0) {
    add("images_missing_alt", "Bilder ohne Alt-Text", `${imagesMissingAlt} von ${images} Bildern ohne alt.`, "Beschreibende Alts für inhaltlich relevante Bilder.", "medium", "m", Math.min(0.5, imagesMissingAlt / 10), { imagesMissingAlt, images });
  }

  if (wordCount > 0 && wordCount < THIN_WORDS && indexable) {
    add("thin_content", "Dünner Inhalt", `Nur ca. ${wordCount} Wörter sichtbar.`, "Inhalt vertiefen oder mit stärkerer Seite zusammenführen.", "medium", "l", 0.4, { wordCount });
  }

  if (!metrics.hasViewport) {
    add("missing_viewport", "Viewport fehlt", "Kein Viewport-Meta – schlecht für Mobile.", "Standard-Viewport-Tag ergänzen.", "medium", "xs", 0.4, {});
  }

  if (!metrics.isHttps) {
    add("not_https", "Kein HTTPS", "Finale URL ist HTTP.", "Auf HTTPS umstellen und weiterleiten.", "high", "m", 0.8, {});
  }

  const deductions = findings.reduce((sum, f) => {
    const map = { critical: 22, high: 12, medium: 7, low: 3, info: 1 };
    return sum + map[f.severity];
  }, 0);
  const score = Math.max(0, Math.min(100, 100 - deductions));

  return { score, metrics, findings, indexable, indexabilityReason };
}

function parseRobots(raw?: string) {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function resolveUrl(base: string, maybe: string | null) {
  if (!maybe) return null;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return maybe;
  }
}

function stripTrailing(url: string) {
  return url.replace(/\/$/, "");
}

function extractSchemaTypes(json: string): string[] {
  try {
    const data = JSON.parse(json);
    const items = Array.isArray(data) ? data : [data];
    return items
      .flatMap((item) => {
        const t = item?.["@type"];
        if (!t) return [];
        return Array.isArray(t) ? t : [t];
      })
      .map(String);
  } catch {
    return [];
  }
}

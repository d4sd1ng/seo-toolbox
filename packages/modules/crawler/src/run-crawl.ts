import { clampToCap, hostnameOf, normalizeUrl } from "core";
import { prisma, workspacePlanCaps } from "db";
import { extractPage, isInternal, shouldSkipUrl } from "./extract";
import { fetchUrl } from "./fetch-url";
import { writeCrawlIssues } from "./issues";
import { renderUrl } from "./render";
import { RenderMonitor } from "./render-monitor";
import { isAllowed, parseRobotsTxt, type RobotsRules } from "./robots";
import { shouldRender } from "./should-render";

const HTTP_CONCURRENCY = 5;
const RENDER_CONCURRENCY = 2;

export type CrawledRecord = {
  url: string;
  status: number;
  title: string | null;
  h1: string | null;
  canonicalUrl: string | null;
  canonicalIsSelf: boolean;
  internalInLinks: number;
  chainLength: number;
  fromHtml: boolean;
  isSeed: boolean;
  rendered?: boolean;
  rawWordCount?: number;
  renderedWordCount?: number;
};

export async function runSiteCrawl(input: {
  projectId: string;
  workspaceId: string;
  jobId: string;
  seedUrl?: string;
  maxUrls?: number;
  renderJavascript?: boolean;
  renderBudget?: number;
}) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
    include: { settings: true },
  });
  const settings = project.settings;
  const caps = await workspacePlanCaps(input.workspaceId);
  const maxUrls = clampToCap(
    input.maxUrls ?? settings?.crawlBudgetMaxUrls,
    caps.crawlMaxUrls,
    caps.crawlMaxUrls,
  );
  const includeSubdomains = settings?.includeSubdomains ?? false;
  const respectRobots = settings?.respectRobotsTxt ?? true;
  const seedUrl = normalizeUrl(input.seedUrl ?? project.homepageUrl);
  const primaryHost = hostnameOf(project.homepageUrl);
  const renderJavascript = input.renderJavascript ?? settings?.renderJavascript ?? false;
  const monitor = new RenderMonitor({
    enabled: renderJavascript,
    renderBudget: clampToCap(input.renderBudget, caps.renderSlots, caps.renderSlots),
  });

  const crawl = await prisma.crawl.create({
    data: {
      projectId: project.id,
      jobId: input.jobId,
      seedUrl,
      maxUrls,
      renderJavascript,
      metrics: monitor.snapshot() as object,
    },
  });

  await prisma.job.update({
    where: { id: input.jobId },
    data: { status: "running", startedAt: new Date(), progress: 3 },
  });

  let robots: RobotsRules = { allow: [], disallow: [] };
  if (respectRobots) {
    robots = await loadRobots(seedUrl);
  }

  const queue: string[] = [seedUrl];
  const seen = new Set<string>([seedUrl]);
  const inLinks = new Map<string, Set<string>>();
  const records: CrawledRecord[] = [];
  let crawled = 0;
  let failed = 0;

  const concurrency = renderJavascript ? RENDER_CONCURRENCY : HTTP_CONCURRENCY;

  while (queue.length > 0 && crawled + failed < maxUrls) {
    const batch = queue.splice(0, Math.min(concurrency, maxUrls - crawled - failed));
    const results = await Promise.all(batch.map((url) => crawlOne({
      url,
      seedUrl,
      primaryHost,
      includeSubdomains,
      respectRobots,
      robots,
      monitor,
    })));

    for (const item of results) {
      if (item.failed) failed += 1;
      else crawled += 1;
      monitor.recordHttp(!item.failed);
      records.push(item.record);

      await upsertPage(project.id, item);

      for (const out of item.outLinks) {
        addInLink(inLinks, out, item.record.url);
        if (!seen.has(out) && seen.size < maxUrls) {
          seen.add(out);
          queue.push(out);
        }
      }
    }

    const done = crawled + failed;
    await prisma.job.update({
      where: { id: input.jobId },
      data: { progress: Math.min(90, Math.round((done / maxUrls) * 80) + 5) },
    });
    await prisma.crawl.update({
      where: { id: crawl.id },
      data: {
        pagesCrawled: crawled,
        pagesFailed: failed,
        metrics: monitor.snapshot() as object,
      },
    });
  }

  for (const [url, sources] of inLinks) {
    await prisma.page.updateMany({
      where: { projectId: project.id, urlNormalized: url },
      data: { internalInLinks: sources.size },
    });
    const rec = records.find((r) => r.url === url);
    if (rec) rec.internalInLinks = sources.size;
  }

  await writeCrawlIssues(project.id, records);

  const snapshot = monitor.snapshot();
  if (snapshot.renderBudgetHit || snapshot.stopReason === "wallclock" || snapshot.circuitOpen) {
    await prisma.issue.create({
      data: {
        projectId: project.id,
        type: "render_budget_exhausted",
        title: `Render gestoppt (${snapshot.stopReason})`,
        description: `${snapshot.renderAttempted}/${snapshot.renderBudget} Slots, RSS ${snapshot.rssMb} MB.`,
        recommendation: "Budget erhöhen oder Hybrid lassen. Der HTTP-Crawl bleibt gültig.",
        severity: "info",
        effort: "xs",
        priorityScore: 0.2,
        status: "open",
        entityType: "project",
        url: seedUrl,
        sourceModule: "crawler",
        evidence: snapshot as object,
      },
    });
  }
  await prisma.crawl.update({
    where: { id: crawl.id },
    data: {
      finishedAt: new Date(),
      pagesCrawled: crawled,
      pagesFailed: failed,
      metrics: snapshot as object,
    },
  });
  await prisma.job.update({
    where: { id: input.jobId },
    data: {
      status: "succeeded",
      progress: 100,
      finishedAt: new Date(),
      resultSummary: `${crawled} URLs, ${failed} Fehler · ${monitor.summaryLine()}`,
    },
  });

  return { crawlId: crawl.id, crawled, failed, metrics: snapshot };
}

async function crawlOne(input: {
  url: string;
  seedUrl: string;
  primaryHost: string;
  includeSubdomains: boolean;
  respectRobots: boolean;
  robots: RobotsRules;
  monitor: RenderMonitor;
}) {
  if (input.respectRobots) {
    try {
      const path = new URL(input.url).pathname;
      if (!isAllowed(path, input.robots)) {
        return blocked(input.url, input.seedUrl, "robots_txt");
      }
    } catch {
      return blocked(input.url, input.seedUrl, "invalid_url");
    }
  }

  const fetched = await fetchUrl(input.url);
  if (fetched.error && fetched.status === 0) {
    return {
      failed: true,
      outLinks: [] as string[],
      record: baseRecord(input.url, input.seedUrl, 0, fetched.chain.length),
      page: {
        url: input.url,
        urlNormalized: input.url,
        path: safePath(input.url),
        httpStatus: 0,
        statusClass: "error" as const,
        indexable: false,
        indexabilityReason: fetched.error,
        title: null as string | null,
        metaDescription: null as string | null,
        h1: null as string | null,
        wordCount: null as number | null,
        canonicalUrl: null as string | null,
        canonicalIsSelf: null as boolean | null,
        robotsDirectives: [] as string[],
        schemaTypes: [] as string[],
        internalOutLinks: 0,
        externalOutLinks: 0,
      },
    };
  }

  const finalNorm = safeNormalize(fetched.finalUrl || input.url);
  const rawExtracted = fetched.html
    ? extractPage({
        baseUrl: fetched.finalUrl || input.url,
        html: fetched.html,
        includeSubdomains: input.includeSubdomains,
        primaryHost: input.primaryHost,
      })
    : null;

  let html = fetched.html;
  let extracted = rawExtracted;
  let rendered = false;
  const isSeed = finalNorm === input.seedUrl || input.url === input.seedUrl;
  const heuristic = shouldRender({
    status: fetched.status,
    html: fetched.html,
    contentType: fetched.contentType,
    isSeed,
  });

  if (heuristic.render) {
    const gate = input.monitor.canRender();
    if (!gate.ok) {
      if (gate.reason === "disabled") {
        /* render off */
      } else {
        input.monitor.recordSkippedHeuristic();
      }
    } else {
      const started = input.monitor.startRender();
      const renderedPage = await renderUrl(fetched.finalUrl || input.url);
      input.monitor.finishRender(started, !renderedPage.error);
      if (!renderedPage.error && renderedPage.html) {
        rendered = true;
        html = renderedPage.html;
        extracted = extractPage({
          baseUrl: renderedPage.finalUrl || fetched.finalUrl || input.url,
          html,
          includeSubdomains: input.includeSubdomains,
          primaryHost: input.primaryHost,
        });
      }
    }
  } else if (input.monitor.canRender().ok) {
    input.monitor.recordSkippedHeuristic();
  }

  const noindex = extracted?.robots.includes("noindex") ?? false;
  const indexable = fetched.status < 400 && !noindex;
  const canonicalIsSelf = Boolean(
    extracted?.canonicalUrl &&
      safeNormalize(extracted.canonicalUrl) === finalNorm,
  );

  const outLinks = (extracted?.internalOut ?? []).filter((url) => {
    if (shouldSkipUrl(url)) return false;
    try {
      return isInternal(url, input.primaryHost, input.includeSubdomains);
    } catch {
      return false;
    }
  });

  return {
    failed: fetched.status >= 400 || Boolean(fetched.error),
    outLinks,
    record: {
      url: finalNorm,
      status: fetched.status,
      title: extracted?.title ?? null,
      h1: extracted?.h1 ?? null,
      canonicalUrl: extracted?.canonicalUrl ?? null,
      canonicalIsSelf,
      internalInLinks: 0,
      chainLength: Math.max(0, fetched.chain.length - 1),
      fromHtml: Boolean(html),
      isSeed,
      rendered,
      rawWordCount: rawExtracted?.wordCount,
      renderedWordCount: extracted?.wordCount,
    },
    page: {
      url: fetched.finalUrl || input.url,
      urlNormalized: finalNorm,
      path: safePath(fetched.finalUrl || input.url),
      httpStatus: fetched.status,
      statusClass: statusClass(fetched.status),
      indexable,
      indexabilityReason: indexable ? null : noindex ? "noindex" : `http_${fetched.status}`,
      title: extracted?.title ?? null,
      metaDescription: extracted?.metaDescription ?? null,
      h1: extracted?.h1 ?? null,
      wordCount: extracted?.wordCount ?? null,
      canonicalUrl: extracted?.canonicalUrl ?? null,
      canonicalIsSelf,
      robotsDirectives: extracted?.robots ?? [],
      schemaTypes: extracted?.schemaTypes ?? [],
      internalOutLinks: outLinks.length,
      externalOutLinks: extracted?.externalOutCount ?? 0,
    },
  };
}

async function upsertPage(
  projectId: string,
  item: Awaited<ReturnType<typeof crawlOne>>,
) {
  await prisma.page.upsert({
    where: {
      projectId_urlNormalized: {
        projectId,
        urlNormalized: item.page.urlNormalized,
      },
    },
    create: {
      projectId,
      lastCrawledAt: new Date(),
      ...item.page,
    },
    update: {
      lastCrawledAt: new Date(),
      url: item.page.url,
      httpStatus: item.page.httpStatus,
      statusClass: item.page.statusClass,
      indexable: item.page.indexable,
      indexabilityReason: item.page.indexabilityReason,
      title: item.page.title,
      metaDescription: item.page.metaDescription,
      h1: item.page.h1,
      wordCount: item.page.wordCount,
      canonicalUrl: item.page.canonicalUrl,
      canonicalIsSelf: item.page.canonicalIsSelf,
      robotsDirectives: item.page.robotsDirectives,
      schemaTypes: item.page.schemaTypes,
      internalOutLinks: item.page.internalOutLinks,
      externalOutLinks: item.page.externalOutLinks,
    },
  });
}

function addInLink(map: Map<string, Set<string>>, target: string, source: string) {
  const set = map.get(target) ?? new Set<string>();
  set.add(source);
  map.set(target, set);
}

async function loadRobots(seedUrl: string): Promise<RobotsRules> {
  try {
    const robotsUrl = new URL("/robots.txt", seedUrl).toString();
    const res = await fetch(robotsUrl, {
      headers: { "user-agent": "SEOToolboxBot/0.1 (+https://localhost)" },
    });
    if (!res.ok) return { allow: [], disallow: [] };
    return parseRobotsTxt(await res.text());
  } catch {
    return { allow: [], disallow: [] };
  }
}

function blocked(url: string, seedUrl: string, reason: string) {
  const norm = safeNormalize(url);
  return {
    failed: false,
    outLinks: [] as string[],
    record: {
      ...baseRecord(norm, seedUrl, 0, 0),
      fromHtml: false,
    },
    page: {
      url,
      urlNormalized: norm,
      path: safePath(url),
      httpStatus: null as number | null,
      statusClass: "blocked" as const,
      indexable: false,
      indexabilityReason: reason,
      title: null as string | null,
      metaDescription: null as string | null,
      h1: null as string | null,
      wordCount: null as number | null,
      canonicalUrl: null as string | null,
      canonicalIsSelf: null as boolean | null,
      robotsDirectives: ["robots_txt"],
      schemaTypes: [] as string[],
      internalOutLinks: 0,
      externalOutLinks: 0,
    },
  };
}

function baseRecord(url: string, seedUrl: string, status: number, chainLength: number): CrawledRecord {
  return {
    url,
    status,
    title: null,
    h1: null,
    canonicalUrl: null,
    canonicalIsSelf: false,
    internalInLinks: 0,
    chainLength,
    fromHtml: false,
    isSeed: url === seedUrl,
  };
}

function statusClass(status: number) {
  if (status >= 200 && status < 300) return "s2xx" as const;
  if (status >= 300 && status < 400) return "s3xx" as const;
  if (status >= 400 && status < 500) return "s4xx" as const;
  if (status >= 500) return "s5xx" as const;
  return "error" as const;
}

function safeNormalize(url: string) {
  try {
    return normalizeUrl(url);
  } catch {
    return url;
  }
}

function safePath(url: string) {
  try {
    return new URL(url).pathname;
  } catch {
    return "/";
  }
}

import { prisma, workspacePlanCaps, type Prisma } from "db";
import { CrawlForm } from "./ui";

type Metrics = {
  httpFetched?: number;
  httpFailed?: number;
  renderAttempted?: number;
  renderSucceeded?: number;
  renderFailed?: number;
  renderSkippedHeuristic?: number;
  renderBudget?: number;
  renderAvgMs?: number;
  renderP95Ms?: number;
  rssMb?: number;
  heapMb?: number;
  stopReason?: string;
  renderBudgetHit?: boolean;
  circuitOpen?: boolean;
};

function RenderMetrics({ metrics }: { metrics: Prisma.JsonValue | null | undefined }) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null;
  const m = metrics as Metrics;
  return (
    <section>
      <h3>Resource Monitor</h3>
      <p>
        HTTP {m.httpFetched ?? 0} ({m.httpFailed ?? 0} fail) · Render {m.renderSucceeded ?? 0}/
        {m.renderAttempted ?? 0} von {m.renderBudget ?? 80}
        {m.renderBudgetHit ? " · Budget voll" : ""}
        {m.circuitOpen ? " · Circuit offen" : ""}
      </p>
      <p>
        avg {m.renderAvgMs ?? 0} ms · p95 {m.renderP95Ms ?? 0} ms · RSS {m.rssMb ?? 0} MB · Heap{" "}
        {m.heapMb ?? 0} MB · {m.stopReason ?? "ok"}
      </p>
    </section>
  );
}

export default async function CrawlPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { settings: true },
  });

  const caps = await workspacePlanCaps(project.workspaceId);

  const lastCrawl = await prisma.crawl.findFirst({
    where: { projectId },
    orderBy: { startedAt: "desc" },
  });

  const [total, s2, s3, s4, s5, blocked, notIndexable] = await Promise.all([
    prisma.page.count({ where: { projectId } }),
    prisma.page.count({ where: { projectId, statusClass: "s2xx" } }),
    prisma.page.count({ where: { projectId, statusClass: "s3xx" } }),
    prisma.page.count({ where: { projectId, statusClass: "s4xx" } }),
    prisma.page.count({ where: { projectId, statusClass: "s5xx" } }),
    prisma.page.count({ where: { projectId, statusClass: "blocked" } }),
    prisma.page.count({ where: { projectId, indexable: false } }),
  ]);

  const sample4xx = await prisma.page.findMany({
    where: { projectId, statusClass: "s4xx" },
    take: 8,
    orderBy: { urlNormalized: "asc" },
    select: { url: true, httpStatus: true },
  });

  return (
    <main style={{ padding: 32, maxWidth: 920 }}>
      <h1>Technischer Crawl</h1>
      <p>
        HTML-first. Optional Hybrid-Render per Playwright: nur leere App-Shells
        und die Startseite, gedeckelt auf {caps.renderSlots} Slots ({caps.plan}).
      </p>
      <CrawlForm
        projectId={projectId}
        defaultUrl={project.homepageUrl}
        defaultMax={Math.min(project.settings?.crawlBudgetMaxUrls ?? caps.crawlMaxUrls, caps.crawlMaxUrls)}
      />
      <section>
        <h2>Bestand</h2>
        {total === 0 ? (
          <p>Noch keine Pages. Crawl starten.</p>
        ) : (
          <p>
            {total} URLs · {s2} 2xx · {s3} 3xx · {s4} 4xx · {s5} 5xx · {blocked}{" "}
            blocked · {notIndexable} nicht indexierbar
          </p>
        )}
        {lastCrawl ? (
          <p>
            Letzter Lauf: {lastCrawl.pagesCrawled} ok / {lastCrawl.pagesFailed} Fehler
            · max {lastCrawl.maxUrls}
            {lastCrawl.finishedAt ? " · fertig" : " · läuft oder abgebrochen"}
          </p>
        ) : null}
        <RenderMetrics metrics={lastCrawl?.metrics} />
      </section>
      {sample4xx.length > 0 ? (
        <section>
          <h2>Beispiel 4xx</h2>
          <ul>
            {sample4xx.map((page) => (
              <li key={page.url}>
                {page.httpStatus} · {page.url}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}

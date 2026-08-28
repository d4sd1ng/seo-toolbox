import { prisma, workspacePlanCaps } from "db";
import { listGscSites, loadGscTokens, querySearchAnalytics } from "./client";
import { gscDefaultRange } from "./dates";
import { writeGscIssues } from "./issues-from-gsc";

export async function runGscSync(input: {
  projectId: string;
  workspaceId: string;
  jobId?: string;
}) {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: input.projectId },
  });
  if (!project.gscSiteUrl) {
    throw new Error("Keine GSC-Property am Projekt. Zuerst Property zuordnen.");
  }

  if (input.jobId) {
    await prisma.job.update({
      where: { id: input.jobId },
      data: { status: "running", startedAt: new Date(), progress: 5 },
    });
  }

  const tokens = await loadGscTokens(input.workspaceId);
  const sites = await listGscSites(tokens.accessToken);
  const allowed = sites.some((s) => s.siteUrl === project.gscSiteUrl);
  if (!allowed) {
    throw new Error(`Keine Berechtigung für ${project.gscSiteUrl}`);
  }

  const { startDate, endDate } = gscDefaultRange();
  const base = {
    accessToken: tokens.accessToken,
    siteUrl: project.gscSiteUrl,
    startDate,
    endDate,
  };

  const byDate = await querySearchAnalytics({ ...base, dimensions: ["date"], rowLimit: 50 });
  if (input.jobId) await setProgress(input.jobId, 25);

  const byQuery = await querySearchAnalytics({ ...base, dimensions: ["query"], rowLimit: 1000 });
  if (input.jobId) await setProgress(input.jobId, 45);

  const byPage = await querySearchAnalytics({ ...base, dimensions: ["page"], rowLimit: 500 });
  if (input.jobId) await setProgress(input.jobId, 60);

  const byQueryPage = await querySearchAnalytics({
    ...base,
    dimensions: ["query", "page"],
    rowLimit: 2500,
  });
  if (input.jobId) await setProgress(input.jobId, 75);

  await upsertRows(
    project.id,
    byDate.map((row) => ({ date: row.keys[0] ?? endDate, query: "", pageUrl: "", row })),
  );
  await upsertRows(
    project.id,
    byQuery.map((row) => ({ date: endDate, query: row.keys[0] ?? "", pageUrl: "", row })),
  );
  await upsertRows(
    project.id,
    byPage.map((row) => ({ date: endDate, query: "", pageUrl: row.keys[0] ?? "", row })),
  );
  await upsertRows(
    project.id,
    byQueryPage.map((row) => ({
      date: endDate,
      query: row.keys[0] ?? "",
      pageUrl: row.keys[1] ?? "",
      row,
    })),
  );

  await importQueriesAsKeywords(
    project.id,
    input.workspaceId,
    project.defaultLocale,
    project.defaultCountry,
    byQuery,
  );

  await writeGscIssues(
    project.id,
    byQueryPage.map((row) => ({
      query: row.keys[0] ?? "",
      pageUrl: row.keys[1] ?? "",
      clicks: row.clicks,
      impressions: row.impressions,
      ctr: row.ctr,
      position: row.position,
    })),
  );

  await prisma.integration.update({
    where: {
      workspaceId_provider: { workspaceId: input.workspaceId, provider: "gsc" },
    },
    data: { lastSyncAt: new Date(), status: "connected" },
  });

  if (input.jobId) {
    await prisma.job.update({
      where: { id: input.jobId },
      data: {
        status: "succeeded",
        progress: 100,
        finishedAt: new Date(),
        resultSummary: `${byQuery.length} Queries, ${byPage.length} Seiten, ${byDate.length} Tage`,
      },
    });
  }

  return {
    startDate,
    endDate,
    queries: byQuery.length,
    pages: byPage.length,
    days: byDate.length,
  };
}

async function importQueriesAsKeywords(
  projectId: string,
  workspaceId: string,
  locale: string,
  country: string,
  rows: Array<{ keys: string[]; impressions: number; clicks: number; position: number }>,
) {
  const caps = await workspacePlanCaps(workspaceId);
  const tracked = await prisma.keyword.count({ where: { project: { workspaceId } } });
  const room = Math.max(0, caps.keywordsTracked - tracked);
  const top = [...rows].sort((a, b) => b.impressions - a.impressions).slice(0, Math.min(200, room || 0));
  for (const row of top) {
    const phrase = row.keys[0]?.trim();
    if (!phrase) continue;
    await prisma.keyword.upsert({
      where: {
        projectId_phrase_locale_country_device: {
          projectId,
          phrase,
          locale,
          country,
          device: "ALL",
        },
      },
      create: {
        projectId,
        phrase,
        locale,
        country,
        device: "ALL",
        source: "gsc",
        volume: Math.round(row.impressions),
      },
      update: { volume: Math.round(row.impressions) },
    });
  }
}

async function upsertRows(
  projectId: string,
  rows: Array<{
    date: string;
    query: string;
    pageUrl: string;
    row: { clicks: number; impressions: number; ctr: number; position: number };
  }>,
) {
  const chunkSize = 50;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map((item) =>
        prisma.searchPerformance.upsert({
          where: uniqueKey(projectId, item.date, item.query, item.pageUrl),
          create: rowData(projectId, item.date, item.query, item.pageUrl, item.row),
          update: metricsOf(item.row),
        }),
      ),
    );
  }
}

function uniqueKey(projectId: string, date: string, query: string, pageUrl: string) {
  return {
    projectId_date_query_pageUrl_country_device: {
      projectId,
      date: new Date(`${date}T00:00:00.000Z`),
      query,
      pageUrl,
      country: "",
      device: "ALL" as const,
    },
  };
}

function rowData(
  projectId: string,
  date: string,
  query: string,
  pageUrl: string,
  row: { clicks: number; impressions: number; ctr: number; position: number },
) {
  return {
    projectId,
    date: new Date(`${date}T00:00:00.000Z`),
    query,
    pageUrl,
    country: "",
    device: "ALL" as const,
    ...metricsOf(row),
  };
}

function metricsOf(row: { clicks: number; impressions: number; ctr: number; position: number }) {
  return {
    clicks: Math.round(row.clicks),
    impressions: Math.round(row.impressions),
    ctr: row.ctr,
    position: row.position,
  };
}

async function setProgress(jobId: string, progress: number) {
  await prisma.job.update({ where: { id: jobId }, data: { progress } });
}

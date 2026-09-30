import { prisma } from "db";
import { runSiteCrawl } from "module-crawler/runtime";
import { runGscSync } from "module-gsc";
import { runOnPageAudit } from "module-onpage/runtime";
import { runBacklinkSync, runContentBrief, runKeywordExpand, runRankCheck } from "module-intel";
import { runPageSpeed } from "module-pagespeed";
import type { QueueJobPayload } from "./index";

export async function processQueuedJob(data: QueueJobPayload) {
  await prisma.job.update({
    where: { id: data.prismaJobId },
    data: { status: "running", startedAt: new Date(), progress: 1, error: null },
  });

  try {
    switch (data.type) {
      case "onpage_audit":
        await runOnPageAudit({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          url: String(data.payload.url),
          jobId: data.prismaJobId,
        });
        break;
      case "gsc_sync":
        await runGscSync({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
        });
        break;
      case "site_crawl":
        await runSiteCrawl({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
          seedUrl: data.payload.seedUrl ? String(data.payload.seedUrl) : undefined,
          maxUrls: data.payload.maxUrls ? Number(data.payload.maxUrls) : undefined,
          renderJavascript: Boolean(data.payload.renderJavascript),
          renderBudget: data.payload.renderBudget
            ? Number(data.payload.renderBudget)
            : undefined,
        });
        break;
      case "pagespeed":
        await runPageSpeed({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
          url: data.payload.url ? String(data.payload.url) : undefined,
          strategy: data.payload.strategy === "desktop" ? "desktop" : "mobile",
        });
        break;
      case "keyword_expand":
        await runKeywordExpand({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
          seed: String(data.payload.seed ?? ""),
        });
        break;
      case "rank_check":
        await runRankCheck({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
        });
        break;
      case "serp_snapshot":
        await runContentBrief({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
          keyword: String(data.payload.keyword ?? ""),
        });
        break;
      case "backlink_sync":
        await runBacklinkSync({
          projectId: data.projectId,
          workspaceId: data.workspaceId,
          jobId: data.prismaJobId,
          target: data.payload.target ? String(data.payload.target) : undefined,
        });
        break;
      default:
        throw new Error(`Kein Handler für Job-Typ ${data.type}`);
    }
  } catch (error) {
    await prisma.job.update({
      where: { id: data.prismaJobId },
      data: {
        status: "failed",
        finishedAt: new Date(),
        error:
          error instanceof Error
            ? "code" in error && typeof (error as { code?: unknown }).code === "string"
              ? `${(error as { code: string }).code}: ${error.message}`
              : error.message
            : "unknown",
      },
    });
    throw error;
  }
}

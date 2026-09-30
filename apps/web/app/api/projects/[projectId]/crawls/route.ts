import { clampToCap } from "core";
import { workspacePlanCaps } from "db";
import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    seedUrl?: string;
    maxUrls?: number;
    renderJavascript?: boolean;
    renderBudget?: number;
  };
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;

  const caps = await workspacePlanCaps(project.workspaceId);
  const maxUrls = clampToCap(
    body.maxUrls ?? project.settings?.crawlBudgetMaxUrls,
    caps.crawlMaxUrls,
    Math.min(project.settings?.crawlBudgetMaxUrls ?? caps.crawlMaxUrls, caps.crawlMaxUrls),
  );
  const renderBudget = clampToCap(body.renderBudget, caps.renderSlots, caps.renderSlots);

  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId,
      type: "site_crawl",
      moduleId: "crawler",
      payload: {
        seedUrl: body.seedUrl ?? project.homepageUrl,
        maxUrls,
        renderJavascript: body.renderJavascript ?? project.settings?.renderJavascript ?? false,
        renderBudget,
      },
    });
    return jsonWithQuota(
      project.workspaceId,
      { ok: true, jobId: job.id, status: job.status },
      { jobType: "site_crawl" },
    );
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return jsonWithQuota(project.workspaceId, { error: message }, { status, jobType: "site_crawl" });
  }
}

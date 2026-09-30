import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    url?: string;
    strategy?: "mobile" | "desktop";
  };
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;

  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId,
      type: "pagespeed",
      moduleId: "pagespeed",
      payload: {
        url: body.url ?? project.homepageUrl,
        strategy: body.strategy ?? "mobile",
      },
    });
    return jsonWithQuota(project.workspaceId, { ok: true, jobId: job.id }, { jobType: "pagespeed" });
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return jsonWithQuota(project.workspaceId, { error: message }, { status, jobType: "pagespeed" });
  }
}

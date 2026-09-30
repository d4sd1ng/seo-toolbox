import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;
  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId,
      type: "backlink_sync",
      moduleId: "backlinks",
      payload: { target: project.primaryDomain },
    });
    return jsonWithQuota(project.workspaceId, { ok: true, jobId: job.id }, { jobType: "backlink_sync" });
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return jsonWithQuota(project.workspaceId, { error: message }, { status, jobType: "backlink_sync" });
  }
}

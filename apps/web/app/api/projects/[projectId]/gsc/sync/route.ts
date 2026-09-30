import { NextResponse } from "next/server";
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
  if (!project.gscSiteUrl) {
    return NextResponse.json({ error: "Zuerst eine GSC-Property zuordnen" }, { status: 400 });
  }

  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId,
      type: "gsc_sync",
      moduleId: "gsc",
      payload: {},
    });
    return jsonWithQuota(
      project.workspaceId,
      { ok: true, jobId: job.id, status: job.status },
      { jobType: "gsc_sync" },
    );
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return jsonWithQuota(project.workspaceId, { error: message }, { status, jobType: "gsc_sync" });
  }
}

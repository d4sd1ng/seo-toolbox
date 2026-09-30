import { NextResponse } from "next/server";
import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json()) as { keyword?: string };
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;
  if (!body.keyword) return NextResponse.json({ error: "keyword fehlt" }, { status: 400 });
  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId,
      type: "serp_snapshot",
      moduleId: "brief",
      payload: { keyword: body.keyword },
    });
    return jsonWithQuota(project.workspaceId, { ok: true, jobId: job.id }, { jobType: "serp_snapshot" });
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return jsonWithQuota(project.workspaceId, { error: message }, { status, jobType: "serp_snapshot" });
  }
}

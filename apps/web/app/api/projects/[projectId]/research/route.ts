import { NextResponse } from "next/server";
import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json()) as { seed?: string };
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;
  if (!body.seed) return NextResponse.json({ error: "seed fehlt" }, { status: 400 });
  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId,
      type: "keyword_expand",
      moduleId: "research",
      payload: { seed: body.seed },
    });
    return jsonWithQuota(project.workspaceId, { ok: true, jobId: job.id }, { jobType: "keyword_expand" });
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return jsonWithQuota(project.workspaceId, { error: message }, { status, jobType: "keyword_expand" });
  }
}

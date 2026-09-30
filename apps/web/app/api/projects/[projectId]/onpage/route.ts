import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json().catch(() => ({}))) as { url?: string };
  if (!body.url) {
    return NextResponse.json({ error: "url fehlt" }, { status: 400 });
  }

  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;

  try {
    const job = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "onpage_audit",
      moduleId: "onpage",
      payload: { url: body.url },
    });
    return jsonWithQuota(
      project.workspaceId,
      { ok: true, id: job.id, jobId: job.id, status: job.status },
      { jobType: "onpage_audit" },
    );
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

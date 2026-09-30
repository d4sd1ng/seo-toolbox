import { enqueueJob, planLimitResponse } from "@/lib/jobs";
import { loadOwnedProject } from "@/lib/project-access";
import { jsonWithQuota } from "@/lib/quota";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await request.json()) as { url?: string };
  if (!body.url) {
    return NextResponse.json({ error: "url fehlt" }, { status: 400 });
  }

  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;

  try {
    const job = await enqueueJob({
      workspaceId: owned.session!.workspaceId,
      projectId: owned.project!.id,
      type: "onpage_audit",
      moduleId: "onpage",
      payload: { url: body.url },
    });
    return jsonWithQuota(owned.session!.workspaceId, { id: job.id, status: job.status });
  } catch (error) {
    const { message, status } = planLimitResponse(error);
    return NextResponse.json({ error: message }, { status });
  }
}

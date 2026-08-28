import { gscAuthUrl, signState } from "module-gsc";
import { NextResponse } from "next/server";
import { loadOwnedProject } from "@/lib/project-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId fehlt" }, { status: 400 });
  }
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;
  const state = signState({ workspaceId: project.workspaceId, projectId });
  return NextResponse.redirect(gscAuthUrl(state));
}

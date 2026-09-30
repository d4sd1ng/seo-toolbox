import { listGscSites, loadGscTokens } from "module-gsc";
import { NextResponse } from "next/server";
import { loadOwnedProject } from "@/lib/project-access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const project = owned.project!;
  try {
    const tokens = await loadGscTokens(project.workspaceId);
    const sites = await listGscSites(tokens.accessToken);
    return NextResponse.json({ sites, selected: project.gscSiteUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GSC nicht verbunden" },
      { status: 400 },
    );
  }
}

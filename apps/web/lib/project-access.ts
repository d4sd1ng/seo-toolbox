import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "./auth";

export async function loadOwnedProject(projectId: string) {
  const session = await getSession();
  if (!session) return { project: null, session: null, error: unauthorized() };
  const project = await prisma.project.findFirst({
    where: { id: projectId, workspaceId: session.workspaceId },
    include: { settings: true, workspace: { select: { plan: true } } },
  });
  if (!project) return { project: null, session, error: NextResponse.json({ error: "Nicht gefunden" }, { status: 404 }) };
  return { project, session, error: null };
}

function unauthorized() {
  return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
}

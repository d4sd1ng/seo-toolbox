import { prisma } from "db";
import { NextResponse } from "next/server";
import { loadOwnedProject } from "@/lib/project-access";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const owned = await loadOwnedProject(projectId);
  if (owned.error) return owned.error;
  const body = (await request.json()) as { siteUrl?: string };
  if (!body.siteUrl) {
    return NextResponse.json({ error: "siteUrl fehlt" }, { status: 400 });
  }
  await prisma.project.update({
    where: { id: projectId },
    data: { gscSiteUrl: body.siteUrl },
  });
  return NextResponse.json({ ok: true });
}

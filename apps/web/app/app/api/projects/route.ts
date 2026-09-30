import { hostnameOf } from "core";
import { prisma, workspacePlanCaps } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const body = (await request.json()) as { url?: string; name?: string };
  if (!body.url) {
    return NextResponse.json({ error: "url fehlt" }, { status: 400 });
  }
  let homepageUrl: string;
  try {
    homepageUrl = new URL(body.url).toString();
  } catch {
    return NextResponse.json({ error: "Ungültige URL" }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
  });
  const caps = await workspacePlanCaps(workspace.id);
  const existing = await prisma.project.count({ where: { workspaceId: workspace.id } });
  if (existing >= caps.projects) {
    return NextResponse.json(
      { error: `Projekt-Limit auf Plan ${caps.plan}: ${caps.projects}` },
      { status: 402 },
    );
  }
  const domain = hostnameOf(homepageUrl);
  const project = await prisma.project.create({
    data: {
      workspaceId: workspace.id,
      name: body.name?.trim() || domain,
      primaryDomain: domain,
      homepageUrl,
      defaultLocale: "de-DE",
      defaultCountry: "DE",
      settings: { create: {} },
    },
  });
  return NextResponse.json({ id: project.id });
}

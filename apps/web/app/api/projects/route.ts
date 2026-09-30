import { hostnameOf } from "core";
import { prisma, workspacePlanCaps } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { enqueueJob } from "@/lib/jobs";

async function startFirstRun(project: {
  id: string;
  workspaceId: string;
  homepageUrl: string;
}) {
  const started: string[] = [];
  try {
    const onpage = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "onpage_audit",
      moduleId: "onpage",
      payload: { url: project.homepageUrl },
    });
    started.push(onpage.id);
  } catch (error) {
    console.error("autostart onpage", error);
  }
  try {
    const crawl = await enqueueJob({
      workspaceId: project.workspaceId,
      projectId: project.id,
      type: "site_crawl",
      moduleId: "crawler",
      payload: {
        seedUrl: project.homepageUrl,
        maxUrls: 80,
        renderJavascript: false,
      },
    });
    started.push(crawl.id);
  } catch (error) {
    console.error("autostart crawl", error);
  }
  return started;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const body = (await request.json()) as { url?: string; name?: string };
  if (!body.url) {
    return NextResponse.json({ error: "Bitte eine URL eintragen" }, { status: 400 });
  }
  let homepageUrl: string;
  try {
    homepageUrl = new URL(body.url).toString();
  } catch {
    return NextResponse.json({ error: "Ungültige URL" }, { status: 400 });
  }

  const caps = await workspacePlanCaps(session.workspaceId);
  const existing = await prisma.project.count({ where: { workspaceId: session.workspaceId } });
  if (existing >= caps.projects) {
    return NextResponse.json(
      { error: `Projekt-Limit auf Plan ${caps.plan}: ${caps.projects}` },
      { status: 402 },
    );
  }
  const domain = hostnameOf(homepageUrl);
  const project = await prisma.project.create({
    data: {
      workspaceId: session.workspaceId,
      name: body.name?.trim() || domain,
      primaryDomain: domain,
      homepageUrl,
      defaultLocale: "de-DE",
      defaultCountry: "DE",
      settings: { create: {} },
    },
  });
  const jobs = await startFirstRun(project);
  return NextResponse.json({ id: project.id, jobs });
}

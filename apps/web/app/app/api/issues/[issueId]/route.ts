import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const STATUSES = ["open", "snoozed", "in_progress", "done", "ignored"] as const;

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ issueId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { issueId } = await params;
  const body = (await request.json()) as { status?: string };
  if (!body.status || !STATUSES.includes(body.status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }
  const existing = await prisma.issue.findFirst({
    where: { id: issueId, project: { workspaceId: session.workspaceId } },
  });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
  const status = body.status as (typeof STATUSES)[number];
  const issue = await prisma.issue.update({
    where: { id: issueId },
    data: {
      status,
      resolvedAt: status === "done" || status === "ignored" ? new Date() : null,
      snoozeUntil:
        status === "snoozed" ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null,
    },
  });
  return NextResponse.json({ id: issue.id, status: issue.status });
}

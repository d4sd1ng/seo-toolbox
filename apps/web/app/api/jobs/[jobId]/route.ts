import { prisma } from "db";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { jobId } = await params;
  const job = await prisma.job.findFirst({
    where: { id: jobId, workspaceId: session.workspaceId },
  });
  if (!job) return NextResponse.json({ error: "Job nicht gefunden" }, { status: 404 });
  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    error: job.error,
    resultSummary: job.resultSummary,
  });
}

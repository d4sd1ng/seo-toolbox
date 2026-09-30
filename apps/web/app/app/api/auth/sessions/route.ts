import { NextResponse } from "next/server";
import { destroyAllSessions, getSession, listSessions, revokeSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const sessions = await listSessions(session.userId);
  return NextResponse.json({
    currentId: session.sessionId,
    sessions,
  });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "1";
  const id = url.searchParams.get("id");
  if (all) {
    await destroyAllSessions(session.userId);
    return NextResponse.json({ ok: true, cleared: "all" });
  }
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });
  await revokeSession(session.userId, id);
  return NextResponse.json({ ok: true, cleared: id });
}

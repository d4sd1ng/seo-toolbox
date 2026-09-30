import { NextResponse } from "next/server";
import { switchWorkspace } from "@/lib/auth";

export async function POST(request: Request) {
  const body = (await request.json()) as { workspaceId?: string };
  if (!body.workspaceId) {
    return NextResponse.json({ error: "workspaceId fehlt" }, { status: 400 });
  }
  try {
    const result = await switchWorkspace(body.workspaceId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Wechsel fehlgeschlagen";
    const status = message.includes("angemeldet") ? 401 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

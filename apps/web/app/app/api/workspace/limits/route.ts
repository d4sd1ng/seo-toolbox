import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildQuotaHeaders } from "@/lib/quota";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  const { usage, headers } = await buildQuotaHeaders(session.workspaceId);
  return NextResponse.json(usage, { headers });
}

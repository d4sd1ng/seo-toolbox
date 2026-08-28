import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSession } from "./auth";

export async function requirePageSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireApiSession() {
  const session = await getSession();
  if (!session) {
    return { session: null, error: NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 }) };
  }
  return { session, error: null };
}

export async function assertWorkspaceAccess(workspaceId: string) {
  const session = await getSession();
  if (!session) return false;
  return session.workspaceId === workspaceId;
}

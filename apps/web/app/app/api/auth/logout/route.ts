import { NextResponse } from "next/server";
import { clearSessionCookieOn, destroySession } from "@/lib/auth";

export async function POST() {
  await destroySession();
  return clearSessionCookieOn(NextResponse.json({ ok: true }));
}

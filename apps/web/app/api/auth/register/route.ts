import { prisma } from "db";
import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string; name?: string };
  if (!body.email || !body.password || body.password.length < 8) {
    return NextResponse.json({ error: "E-Mail und Passwort (min. 8) nötig" }, { status: 400 });
  }
  const email = body.email.toLowerCase().trim();
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists?.passwordHash) {
    return NextResponse.json({ error: "Konto existiert bereits" }, { status: 409 });
  }
  const slug = email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase() + "-" + Date.now().toString(36);
  const user = exists
    ? await prisma.user.update({
        where: { id: exists.id },
        data: { passwordHash: hashPassword(body.password), name: body.name ?? exists.name },
      })
    : await prisma.user.create({
        data: { email, name: body.name ?? null, passwordHash: hashPassword(body.password) },
      });
  const workspace = await prisma.workspace.create({
    data: { name: body.name || "Workspace", slug, plan: "free" },
  });
  await prisma.membership.create({
    data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
  });
  await setSessionCookie({ userId: user.id, workspaceId: workspace.id });
  return NextResponse.json({ ok: true, workspaceId: workspace.id });
}

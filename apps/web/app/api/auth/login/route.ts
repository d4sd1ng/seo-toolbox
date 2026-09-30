import { prisma } from "db";
import { createSessionToken } from "@/lib/auth";
import { authError, authOk, prismaHint, readAuthFields } from "@/lib/auth-http";
import { verifyPassword } from "@/lib/password";
import { enforceToolRateLimit } from "@/lib/rate-limit";

export async function GET() {
  return Response.json({ ok: true, route: "login" });
}

export async function POST(request: Request) {
  const limited = await enforceToolRateLimit(request, "account_login");
  if (limited) return limited;
  const fields = await readAuthFields(request);
  try {
    if (!fields.email || !fields.password) {
      return authError(fields.json, request, "E-Mail und Passwort eingeben");
    }
    const user = await prisma.user.findUnique({
      where: { email: fields.email.toLowerCase() },
      include: { memberships: true },
    });
    if (!user?.passwordHash || !verifyPassword(fields.password, user.passwordHash)) {
      return authError(fields.json, request, "E-Mail oder Passwort falsch", 401);
    }
    const last = await prisma.session.findFirst({
      where: { userId: user.id },
      orderBy: { lastSeenAt: "desc" },
    });
    const membership =
      user.memberships.find((m) => m.workspaceId === last?.workspaceId) ??
      user.memberships.find((m) => m.role === "owner") ??
      user.memberships[0];
    if (!membership) {
      return authError(fields.json, request, "Kein Workspace für dieses Konto", 403);
    }
    const token = await createSessionToken(user.id, membership.workspaceId);
    return authOk(fields.json, request, token, fields.next);
  } catch (error) {
    console.error("login", error);
    return authError(fields.json, request, prismaHint(error), 500);
  }
}

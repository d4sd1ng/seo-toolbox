import { prisma } from "db";
import { createSessionToken } from "@/lib/auth";
import { authError, authOk, prismaHint, readAuthFields } from "@/lib/auth-http";
import { hashPassword } from "@/lib/password";
import { enforceToolRateLimit } from "@/lib/rate-limit";

export async function GET() {
  return Response.json({ ok: true, route: "register" });
}

export async function POST(request: Request) {
  const limited = await enforceToolRateLimit(request, "account_register");
  if (limited) return limited;
  const fields = await readAuthFields(request);
  try {
    if (!fields.email || !fields.password || fields.password.length < 8) {
      return authError(fields.json, request, "E-Mail und Passwort (min. 8 Zeichen) nötig");
    }
    if (!fields.email.includes("@")) {
      return authError(fields.json, request, "Ungültige E-Mail");
    }
    const email = fields.email.toLowerCase();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists?.passwordHash) {
      return authError(fields.json, request, "Konto existiert bereits", 409);
    }
    const slug =
      email.split("@")[0].replace(/[^a-z0-9]+/gi, "-").toLowerCase() +
      "-" +
      Date.now().toString(36);
    const user = exists
      ? await prisma.user.update({
          where: { id: exists.id },
          data: { passwordHash: hashPassword(fields.password), name: fields.name || exists.name },
        })
      : await prisma.user.create({
          data: {
            email,
            name: fields.name || email.split("@")[0],
            passwordHash: hashPassword(fields.password),
          },
        });
    const workspace = await prisma.workspace.create({
      data: {
        name: fields.name || `${email.split("@")[0]} Workspace`,
        slug,
        plan: "free",
      },
    });
    await prisma.membership.create({
      data: { workspaceId: workspace.id, userId: user.id, role: "owner" },
    });
    const token = await createSessionToken(user.id, workspace.id);
    return authOk(fields.json, request, token, fields.next);
  } catch (error) {
    console.error("register", error);
    return authError(fields.json, request, prismaHint(error), 500);
  }
}

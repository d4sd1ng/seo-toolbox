import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "db";

export const SESSION_COOKIE = "seo_session";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export type AuthSession = {
  sessionId: string;
  userId: string;
  workspaceId: string;
  exp: number;
  user: { id: string; email: string; name: string | null };
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function writeCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function createSession(userId: string, workspaceId: string) {
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (!membership) throw new Error("Kein Zugriff auf diesen Workspace");
  const token = randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      workspaceId,
      expiresAt: new Date(Date.now() + TTL_MS),
    },
  });
  await writeCookie(token);
  return token;
}

export async function getSession(): Promise<AuthSession | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    if (row) await prisma.session.delete({ where: { id: row.id } }).catch(() => undefined);
    jar.delete(SESSION_COOKIE);
    return null;
  }
  const remaining = row.expiresAt.getTime() - Date.now();
  if (remaining < REFRESH_AFTER_MS) {
    await prisma.session.update({
      where: { id: row.id },
      data: { expiresAt: new Date(Date.now() + TTL_MS), lastSeenAt: new Date() },
    });
    await writeCookie(token);
  } else if (Date.now() - row.lastSeenAt.getTime() > 10 * 60 * 1000) {
    await prisma.session.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date() },
    });
  }
  return {
    sessionId: row.id,
    userId: row.userId,
    workspaceId: row.workspaceId,
    exp: row.expiresAt.getTime(),
    user: { id: row.user.id, email: row.user.email, name: row.user.name },
  };
}

export async function switchWorkspace(workspaceId: string) {
  const session = await getSession();
  if (!session) throw new Error("Nicht angemeldet");
  const membership = await prisma.membership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId: session.userId } },
  });
  if (!membership) throw new Error("Kein Zugriff auf diesen Workspace");
  await prisma.session.update({
    where: { id: session.sessionId },
    data: { workspaceId, lastSeenAt: new Date() },
  });
  return { workspaceId };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(SESSION_COOKIE);
}

export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function listSessions(userId: string) {
  await prisma.session.deleteMany({
    where: { userId, expiresAt: { lt: new Date() } },
  });
  return prisma.session.findMany({
    where: { userId },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      workspaceId: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
    },
  });
}

export async function revokeSession(userId: string, sessionId: string) {
  await prisma.session.deleteMany({ where: { id: sessionId, userId } });
}

export async function setSessionCookie(input: { userId: string; workspaceId: string }) {
  await createSession(input.userId, input.workspaceId);
}

export async function clearSessionCookie() {
  await destroySession();
}

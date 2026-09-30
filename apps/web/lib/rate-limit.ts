import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { NextResponse } from "next/server";
import { prisma, type Plan } from "db";

export type RateLimitedTool =
  | "onpage_audit"
  | "keyword_check"
  | "robots_sitemap"
  | "crawl_demo"
  | "gsc_preview"
  | "account_register"
  | "account_login";

export const TOOL_HOURLY_LIMITS: Record<RateLimitedTool, Record<Plan, number>> = {
  onpage_audit: { free: 3, pro: 50, agency: 500 },
  keyword_check: { free: 0, pro: 100, agency: 1000 },
  robots_sitemap: { free: 5, pro: 100, agency: 1000 },
  crawl_demo: { free: 2, pro: 20, agency: 200 },
  gsc_preview: { free: 0, pro: 0, agency: 0 },
  account_register: { free: 5, pro: 5, agency: 5 },
  account_login: { free: 10, pro: 10, agency: 10 },
};

const HOUR_MS = 60 * 60 * 1000;
const RETENTION_MS = 30 * 24 * HOUR_MS;
const PRUNE_INTERVAL_MS = HOUR_MS;
const VISITOR_COOKIE = "nv_tool_visitor";
const TRIAL_PERIOD = new Date(0);
let lastPruneAt = 0;

export function utcHourStart(timestamp: number) {
  return new Date(Math.floor(timestamp / HOUR_MS) * HOUR_MS);
}

export function toolHourlyLimit(tool: RateLimitedTool, plan: Plan) {
  return TOOL_HOURLY_LIMITS[tool][plan];
}

function clientIp(request: Request) {
  const candidate =
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  return isIP(candidate) ? candidate : "unknown";
}

export function isPlatformOwner(email?: string) {
  if (!email) return false;
  const allowlist = (process.env.TOOLBOX_OWNER_EMAILS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return allowlist.includes(email.toLowerCase());
}

async function pruneExpiredBuckets(now: number) {
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  await prisma.rateLimitBucket
    .deleteMany({ where: { periodStart: { lt: new Date(now - RETENTION_MS) }, tool: { not: "visitor_trial" } } })
    .catch((error) => console.error("rate-limit-prune", error));
}

function ipSecret() {
  const secret = process.env.RATE_LIMIT_IP_SECRET;
  if (!secret || secret.length < 32) throw new Error("RATE_LIMIT_IP_SECRET fehlt oder ist zu kurz.");
  return secret;
}

function signVisitor(id: string, secret: string) {
  return createHmac("sha256", secret).update(id).digest("base64url");
}

function visitorFromRequest(request: Request, secret: string) {
  const raw = request.headers.get("cookie")?.match(/(?:^|;\s*)nv_tool_visitor=([^;]+)/)?.[1];
  if (raw) {
    const [id, signature] = raw.split(".");
    if (id && signature && /^[a-f0-9]{32}$/.test(id)) {
      const expected = Buffer.from(signVisitor(id, secret));
      const supplied = Buffer.from(signature);
      if (expected.length === supplied.length && timingSafeEqual(expected, supplied)) {
        return { id, token: raw, fresh: false };
      }
    }
  }
  const id = randomBytes(16).toString("hex");
  return { id, token: `${id}.${signVisitor(id, secret)}`, fresh: true };
}

export function attachVisitorCookie(response: NextResponse, token: string) {
  response.cookies.set(VISITOR_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/tools",
    maxAge: 365 * 24 * 60 * 60,
  });
  return response;
}

export async function publicToolStatus(request: Request, tool: RateLimitedTool, plan: Plan, ownerEmail?: string) {
  const secret = ipSecret();
  const visitor = visitorFromRequest(request, secret);
  const owner = isPlatformOwner(ownerEmail);
  const limit = owner ? null : toolHourlyLimit(tool, plan);
  const periodStart = utcHourStart(Date.now());
  const ipHash = createHmac("sha256", secret).update(clientIp(request)).digest("hex");
  const [bucket, trial] = await Promise.all([
    prisma.rateLimitBucket.findUnique({ where: { ipHash_tool_periodStart: { ipHash, tool, periodStart } }, select: { count: true } }),
    prisma.rateLimitBucket.findUnique({ where: { ipHash_tool_periodStart: { ipHash: createHmac("sha256", secret).update(visitor.id).digest("hex"), tool: "visitor_trial", periodStart: TRIAL_PERIOD } }, select: { count: true } }),
  ]);
  return {
    visitor,
    tool,
    plan,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - (bucket?.count ?? 0)),
    resetAt: new Date(periodStart.getTime() + HOUR_MS).toISOString(),
    gateRequired: Boolean(trial),
    available: owner || (limit ?? 0) > 0,
  };
}

export async function consumeAnonymousTrial(request: Request) {
  const secret = ipSecret();
  const visitor = visitorFromRequest(request, secret);
  const ipHash = createHmac("sha256", secret).update(visitor.id).digest("hex");
  try {
    await prisma.rateLimitBucket.create({ data: { ipHash, tool: "visitor_trial", periodStart: TRIAL_PERIOD, count: 1 } });
    return { allowed: true, token: visitor.token };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { allowed: false, token: visitor.token };
    }
    throw error;
  }
}

export async function releaseAnonymousTrial(token: string) {
  const id = token.split(".")[0];
  if (!/^[a-f0-9]{32}$/.test(id)) return;
  const ipHash = createHmac("sha256", ipSecret()).update(id).digest("hex");
  await prisma.rateLimitBucket.deleteMany({
    where: { ipHash, tool: "visitor_trial", periodStart: TRIAL_PERIOD },
  });
}

export async function enforceToolRateLimit(
  request: Request,
  tool: RateLimitedTool,
  options: { plan?: Plan; ownerEmail?: string } = {},
) {
  const plan = options.plan ?? "free";
  const ownerExempt =
    tool !== "account_register" &&
    tool !== "account_login" &&
    isPlatformOwner(options.ownerEmail);
  if (ownerExempt) return null;

  const limit = toolHourlyLimit(tool, plan);
  if (limit === 0) {
    return NextResponse.json(
      { error: "Dieses Tool ist in deinem aktuellen Tarif nicht verfügbar." },
      { status: 403 },
    );
  }

  const secret = process.env.RATE_LIMIT_IP_SECRET;
  if (!secret || secret.length < 32) {
    console.error("RATE_LIMIT_IP_SECRET fehlt oder ist zu kurz.");
    return NextResponse.json({ error: "Rate-Limit nicht verfügbar." }, { status: 503 });
  }

  const now = Date.now();
  const periodStart = utcHourStart(now);
  const ipHash = createHmac("sha256", secret).update(clientIp(request)).digest("hex");

  try {
    const bucket = await prisma.rateLimitBucket.upsert({
      where: {
        ipHash_tool_periodStart: { ipHash, tool, periodStart },
      },
      create: { ipHash, tool, periodStart, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    });
    void pruneExpiredBuckets(now);

    const remaining = Math.max(0, limit - bucket.count);
    const resetAt = new Date(periodStart.getTime() + HOUR_MS);
    const headers = {
      "RateLimit-Limit": String(limit),
      "RateLimit-Remaining": String(remaining),
      "RateLimit-Reset": String(Math.floor(resetAt.getTime() / 1000)),
    };

    if (bucket.count > limit) {
      return NextResponse.json(
        { error: "Stundenlimit für dieses Tool erreicht." },
        {
          status: 429,
          headers: {
            ...headers,
            "Retry-After": String(Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000))),
          },
        },
      );
    }

    return null;
  } catch (error) {
    console.error("rate-limit", error);
    return NextResponse.json({ error: "Rate-Limit nicht verfügbar." }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { prisma, type Plan } from "db";
import { getSession } from "@/lib/auth";
import { attachVisitorCookie, consumeAnonymousTrial, enforceToolRateLimit, isPlatformOwner, publicToolStatus, releaseAnonymousTrial, type RateLimitedTool } from "@/lib/rate-limit";
import { audit, crawlDemo, keywordCheck, robotsSitemap, safeTarget } from "@/lib/public-tools";
import { loadGscTokens, querySearchAnalytics } from "module-gsc";

const TOOLS: Record<string, RateLimitedTool> = {
  audit: "onpage_audit",
  "keyword-check": "keyword_check",
  "robots-sitemap": "robots_sitemap",
  "crawl-demo": "crawl_demo",
  "gsc-preview": "gsc_preview",
};

function cors(request: Request, response: NextResponse) {
  const origin = request.headers.get("origin");
  if (origin === "https://nurovelle.de") {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
    response.headers.set("Access-Control-Allow-Headers", "content-type");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.headers.set("Vary", "Origin");
  }
  response.headers.set("Cache-Control", "no-store");
  return response;
}

function json(request: Request, body: unknown, status = 200, token?: string) {
  const response = NextResponse.json(body, { status });
  if (token) attachVisitorCookie(response, token);
  return cors(request, response);
}

async function context(request: Request, slug: string) {
  const tool = TOOLS[slug];
  if (!tool) return null;
  const session = await getSession();
  const workspace = session ? await prisma.workspace.findUnique({ where: { id: session.workspaceId }, select: { plan: true } }) : null;
  const plan: Plan = workspace?.plan ?? "free";
  const ownerEmail = session?.user.email;
  const status = await publicToolStatus(request, tool, plan, ownerEmail);
  return { tool, session, plan, ownerEmail, status };
}

export async function OPTIONS(request: Request) {
  if (request.headers.get("origin") !== "https://nurovelle.de") return new NextResponse(null, { status: 403 });
  return cors(request, new NextResponse(null, { status: 204 }));
}

export async function GET(request: Request, { params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  try {
    const ctx = await context(request, slug);
    if (!ctx) return json(request, { error: "Tool nicht gefunden.", code: "not_found" }, 404);
    const { visitor, ...status } = ctx.status;
    const projects = slug === "gsc-preview" && ctx.session && isPlatformOwner(ctx.ownerEmail)
      ? await prisma.project.findMany({
          where: { workspaceId: ctx.session.workspaceId, gscSiteUrl: { not: null } },
          select: { id: true, name: true, gscSiteUrl: true },
          orderBy: { name: "asc" },
        })
      : [];
    return json(request, { ...status, gateRequired: !ctx.session && status.gateRequired, projects }, 200, visitor.token);
  } catch (error) {
    console.error("public-tool-status", error);
    return json(request, { error: "Status nicht verfügbar.", code: "unavailable" }, 503);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params;
  let token: string | undefined;
  let reservedTrial = false;
  try {
    const ctx = await context(request, slug);
    if (!ctx) return json(request, { error: "Tool nicht gefunden.", code: "not_found" }, 404);
    token = ctx.status.visitor.token;
    if (!ctx.status.available) {
      return json(request, { error: "Dieses Tool ist in deinem aktuellen Tarif nicht verfügbar.", code: "plan_unavailable" }, 403, token);
    }
    if (slug === "gsc-preview" && !isPlatformOwner(ctx.ownerEmail)) {
      return json(request, { error: "Nur für Owner verfügbar.", code: "owner_only" }, 403, token);
    }
    const body = (await request.json().catch(() => null)) as { url?: unknown; seed?: unknown; projectId?: unknown } | null;
    if (!body || typeof body !== "object") return json(request, { error: "JSON-Body fehlt.", code: "invalid_input" }, 400, token);
    if (slug === "keyword-check" ? typeof body.seed !== "string" : slug === "gsc-preview" ? typeof body.projectId !== "string" : typeof body.url !== "string") {
      return json(request, { error: "Erforderliches Eingabefeld fehlt.", code: "invalid_input" }, 400, token);
    }
    if (slug === "keyword-check") {
      if (!(body.seed as string).trim() || (body.seed as string).length > 120) return json(request, { error: "Keyword muss 1 bis 120 Zeichen haben.", code: "invalid_input" }, 400, token);
    } else if (slug !== "gsc-preview") {
      if (!(body.url as string).trim() || (body.url as string).length > 2048) return json(request, { error: "URL muss 1 bis 2048 Zeichen haben.", code: "invalid_input" }, 400, token);
      await safeTarget(body.url as string);
    }
    if (!ctx.session) {
      const trial = await consumeAnonymousTrial(request);
      token = trial.token;
      if (!trial.allowed) {
        return json(request, { error: "Bitte anmelden, um die Tools weiter zu nutzen.", code: "email_required", loginUrl: "/login?next=%2Ftoolbox%2Fembed" }, 401, token);
      }
      reservedTrial = true;
    }
    const limited = await enforceToolRateLimit(request, ctx.tool, { plan: ctx.plan, ownerEmail: ctx.ownerEmail });
    if (limited) {
      if (reservedTrial) await releaseAnonymousTrial(token);
      return cors(request, attachVisitorCookie(limited, token));
    }
    let data: unknown;
    if (slug === "audit") data = await audit(body.url as string);
    else if (slug === "robots-sitemap") data = await robotsSitemap(body.url as string);
    else if (slug === "crawl-demo") data = await crawlDemo(body.url as string);
    else if (slug === "keyword-check") data = await keywordCheck(body.seed as string);
    else {
      const project = await prisma.project.findFirst({ where: { id: body.projectId as string, workspaceId: ctx.session!.workspaceId }, select: { gscSiteUrl: true } });
      if (!project?.gscSiteUrl) return json(request, { error: "GSC-Projekt nicht gefunden oder nicht verbunden.", code: "invalid_project" }, 400, token);
      const credentials = await loadGscTokens(ctx.session!.workspaceId);
      const end = new Date();
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const rows = await querySearchAnalytics({ accessToken: credentials.accessToken, siteUrl: project.gscSiteUrl, startDate: start.toISOString().slice(0, 10), endDate: end.toISOString().slice(0, 10), dimensions: ["query"], rowLimit: 10 });
      data = { siteUrl: project.gscSiteUrl, rows };
    }
    const latest = await publicToolStatus(request, ctx.tool, ctx.plan, ctx.ownerEmail);
    const { visitor: _visitor, ...limits } = latest;
    return json(request, { ok: true, tool: slug, data, limits, gateRequired: !ctx.session }, 200, token);
  } catch (error) {
    if (reservedTrial && token) await releaseAnonymousTrial(token).catch((cause) => console.error("trial-release", cause));
    console.error("public-tool", error);
    const message = error instanceof Error ? error.message : "Tool nicht verfügbar.";
    const invalid = /URL|Keyword fehlt|öffentlich|HTTPS|Port|HTML/i.test(message);
    return json(request, { error: invalid ? message : "Tool derzeit nicht verfügbar.", code: invalid ? "invalid_input" : "unavailable" }, invalid ? 400 : 503, token);
  }
}

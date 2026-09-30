import { encryptJson } from "core";
import { prisma } from "db";
import { exchangeCode, listGscSites, readState } from "module-gsc";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  if (!code || !stateRaw) {
    return NextResponse.json({ error: "code/state fehlt" }, { status: 400 });
  }

  const state = readState(stateRaw);
  const tokens = await exchangeCode(code);
  const sites = await listGscSites(tokens.accessToken);
  const email = sites[0]?.siteUrl ?? "Search Console";

  await prisma.integration.upsert({
    where: {
      workspaceId_provider: { workspaceId: state.workspaceId, provider: "gsc" },
    },
    create: {
      workspaceId: state.workspaceId,
      provider: "gsc",
      status: "connected",
      accountLabel: email,
      scopes: ["webmasters.readonly"],
      credentialsRef: encryptJson({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
      }),
    },
    update: {
      status: "connected",
      accountLabel: email,
      credentialsRef: encryptJson({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
      }),
    },
  });

  return NextResponse.redirect(new URL(`/p/${state.projectId}/gsc?connected=1`, url.origin));
}

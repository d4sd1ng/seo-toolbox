import { PLAN_CAPS } from "core";
import { prisma, workspaceUsage } from "db";
import { getSession, listSessions } from "@/lib/auth";
import { QuotaList } from "@/app/components/quota";
import { BillingForm, InviteForm, LogoutButton, SerperForm, SessionList, WorkspaceSwitch } from "./ui";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) {
    return (
      <main style={{ padding: 32 }}>
        <p>
          <a href="/login">Bitte anmelden</a>
        </p>
      </main>
    );
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: session.workspaceId },
    include: { members: { include: { user: true } } },
  });
  const usage = await workspaceUsage(session.workspaceId);
  const serper = await prisma.integration.findUnique({
    where: { workspaceId_provider: { workspaceId: session.workspaceId, provider: "serper" } },
  });
  const [memberships, sessions] = await Promise.all([
    prisma.membership.findMany({
      where: { userId: session.userId },
      include: { workspace: true },
    }),
    listSessions(session.userId),
  ]);

  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 24 }}>
      <h1>Team & Billing</h1>
      <p>
        {session.user.email} · Workspace {workspace.name} · Plan{" "}
        <strong>{workspace.plan}</strong>
      </p>
      <WorkspaceSwitch
        currentId={workspace.id}
        workspaces={memberships.map((m) => ({
          id: m.workspace.id,
          name: m.workspace.name,
          plan: m.workspace.plan,
        }))}
      />
      <h2>Mitglieder</h2>
      <ul>
        {workspace.members.map((m) => (
          <li key={m.id}>
            {m.user.email} · {m.role}
          </li>
        ))}
      </ul>
      <InviteForm />
      <h2>Serper</h2>
      <SerperForm
        connected={Boolean(serper) || Boolean(process.env.SERPER_API_KEY)}
        source={serper ? "workspace" : process.env.SERPER_API_KEY ? "env" : null}
        status={serper?.status ?? null}
      />
      <h2>Plan</h2>
      <p>Abo über Stripe. Caps gelten, sobald der Webhook den Plan setzt.</p>
      <BillingForm current={workspace.plan} />
      <h2>Verbrauch heute</h2>
      <QuotaList quotas={usage.quotas} />
      <CapsTable active={workspace.plan} />
      <h2>Sitzungen</h2>
      <SessionList currentId={session.sessionId} sessions={sessions} />
      <LogoutButton />
    </main>
  );
}

function CapsTable({ active }: { active: string }) {
  const rows: Array<[string, keyof (typeof PLAN_CAPS)["free"]]> = [
    ["Projekte", "projects"],
    ["Mitglieder", "members"],
    ["Crawl-URLs", "crawlMaxUrls"],
    ["Render-Slots", "renderSlots"],
    ["Rankings / Lauf", "rankKeywordsPerRun"],
    ["Rank-Läufe / Tag", "rankRunsPerDay"],
    ["Keyword-Ideen", "keywordIdeas"],
    ["PageSpeed / Tag", "pagespeedPerDay"],
    ["Recherche / Tag", "researchPerDay"],
    ["Backlink-Sync / Tag", "backlinkSyncsPerDay"],
    ["Crawls / Tag", "crawlsPerDay"],
    ["On-Page / Tag", "onpagePerDay"],
    ["GSC-Syncs / Tag", "gscSyncsPerDay"],
    ["Keywords gesamt", "keywordsTracked"],
    ["Parallele Jobs", "concurrentJobs"],
  ];
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 16 }}>
      <thead>
        <tr>
          <th align="left">Cap</th>
          <th align="left">Free</th>
          <th align="left">Pro</th>
          <th align="left">Agency</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, key]) => (
          <tr key={key}>
            <td>{label}</td>
            <td style={{ fontWeight: active === "free" ? 700 : 400 }}>{PLAN_CAPS.free[key]}</td>
            <td style={{ fontWeight: active === "pro" ? 700 : 400 }}>{PLAN_CAPS.pro[key]}</td>
            <td style={{ fontWeight: active === "agency" ? 700 : 400 }}>{PLAN_CAPS.agency[key]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

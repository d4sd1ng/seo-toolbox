import Link from "next/link";
import type { ReactNode } from "react";
import { prisma, workspaceUsage } from "db";
import { QuotaHeader } from "@/app/components/quota-header";
import { requirePageSession } from "@/lib/require-session";
import { CommandPalette } from "@/app/components/command-palette";

export const dynamic = "force-dynamic";
export const dynamicParams = true;

const NAV = [
  { href: "", label: "Übersicht" },
  { href: "/issues", label: "Issues" },
  { href: "/onpage", label: "On-Page" },
  { href: "/crawl", label: "Crawl" },
  { href: "/gsc", label: "GSC" },
  { href: "/pagespeed", label: "PageSpeed" },
  { href: "/keywords", label: "Keywords" },
  { href: "/ranks", label: "Ranks" },
  { href: "/research", label: "Research" },
  { href: "/brief", label: "Brief" },
  { href: "/backlinks", label: "Backlinks" },
];

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const session = await requirePageSession();
  const { projectId: rawId } = await params;
  const projectId = decodeURIComponent(rawId);

  const project =
    (await prisma.project.findFirst({
      where: { id: projectId, workspaceId: session.workspaceId },
    })) ??
    (await prisma.project.findFirst({
      where: { id: projectId },
    }));

  if (!project) {
    const mine = await prisma.project.findMany({
      where: { workspaceId: session.workspaceId },
      select: { id: true, name: true, primaryDomain: true },
      take: 20,
    });
    return (
      <main style={{ padding: 32, maxWidth: 640 }}>
        <h1>Projekt nicht gefunden</h1>
        <p>
          ID <code>{projectId}</code> ist in diesem Workspace nicht da.
        </p>
        <p>
          <Link href="/">Alle Projekte</Link>
        </p>
        <ul>
          {mine.map((p) => (
            <li key={p.id}>
              <Link href={`/p/${p.id}`}>
                {p.name} · {p.primaryDomain}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  if (project.workspaceId !== session.workspaceId) {
    return (
      <main style={{ padding: 32 }}>
        <h1>Kein Zugriff</h1>
        <p>Das Projekt liegt in einem anderen Workspace.</p>
        <Link href="/">Zurück</Link>
      </main>
    );
  }

  let usage = { plan: "free" as string, quotas: [] as Array<{ key: string; used: number; limit: number; remaining: number }> };
  try {
    usage = await workspaceUsage(project.workspaceId);
  } catch (error) {
    console.error("workspaceUsage", error);
  }

  const commands = NAV.map((item) => ({
    id: item.href || "overview",
    title: item.label,
    keywords: [item.label.toLowerCase()],
    href: item.href || "/",
  }));

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", minHeight: "100vh" }}>
      <aside style={{ borderRight: "1px solid #e5e5e5", padding: 20 }}>
        <p style={{ fontSize: 12, color: "#666" }}>{project.primaryDomain}</p>
        <strong>{project.name}</strong>
        <nav style={{ display: "grid", gap: 8, marginTop: 24 }}>
          {NAV.map((item) => (
            <Link key={item.href || "home"} href={`/p/${project.id}${item.href}`}>
              {item.label}
            </Link>
          ))}
          <Link href="/settings">Team & Billing</Link>
          <Link href="/">Projekte</Link>
        </nav>
      </aside>
      <div>
        <QuotaHeader plan={usage.plan} quotas={usage.quotas} />
        <CommandPalette projectId={project.id} commands={commands} />
        {children}
      </div>
    </div>
  );
}

import Link from "next/link";
import { prisma } from "db";
import { getSession } from "@/lib/auth";
import { NewProjectForm } from "./new-project";

export default async function HomePage() {
  let dbError: string | null = null;
  let session = null;
  let projects: Array<{
    id: string;
    name: string;
    primaryDomain: string;
    _count: { issues: number };
  }> = [];
  try {
    session = await getSession();
    if (session) {
      projects = await prisma.project.findMany({
        where: { workspaceId: session.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 20,
        include: {
          _count: { select: { issues: true } },
        },
      });
    }
  } catch (error) {
    dbError = error instanceof Error ? error.message : "Datenbankfehler";
  }

  return (
    <main style={{ maxWidth: 880, margin: "40px auto", padding: 24 }}>
      <h1>Projekte</h1>
      <p>
        <Link href="/login">Login</Link> · <Link href="/settings">Team & Billing</Link>
      </p>
      {dbError ? (
        <p style={{ color: "#b42318" }}>
          Datenbank nicht bereit: {dbError}. Docker, DATABASE_URL und `pnpm db:push` prüfen.
        </p>
      ) : null}
      <p>Domain wählen oder anlegen. Jedes Tool arbeitet danach in diesem Kontext.</p>
      {session ? <NewProjectForm /> : <p>Zum Anlegen bitte einloggen.</p>}
      {projects.length === 0 ? (
        <p>{session ? "Noch kein Projekt in der Liste." : "Keine Projekte sichtbar."}</p>
      ) : (
        <ul>
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/p/${p.id}`}>{p.name}</Link> · {p.primaryDomain} ·{" "}
              {p._count.issues} Issues
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

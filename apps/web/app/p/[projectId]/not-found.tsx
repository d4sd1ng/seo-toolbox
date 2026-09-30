import Link from "next/link";

export default function ProjectNotFound() {
  return (
    <main style={{ padding: 32 }}>
      <h1>Seite nicht gefunden</h1>
      <p>Dieses Projekt-URL-Segment gibt es nicht.</p>
      <p>
        <Link href="/">Zu den Projekten</Link>
      </p>
    </main>
  );
}

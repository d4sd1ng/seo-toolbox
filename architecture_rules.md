# SEO Toolbox – Architekturregeln

Status: in Arbeit

## Bestehende Grenzen

- `apps/web` enthält die Next.js-App und ihre API-Routen.
- `apps/worker` verarbeitet asynchrone Jobs.
- `packages/db/prisma/schema.prisma` definiert `User`, `Membership`, `Workspace`, `Plan` und weitere Datenmodelle.
- `apps/web/lib/auth.ts` verwaltet die vorhandenen Sessions.
- `apps/web/app/api/billing/` enthält Stripe Checkout, Portal, Plan und Webhook.
- `docker-compose.prod.yml` routet die Web-App über Traefik auf `seo.nurovelle.de`.

## Änderungsgrenze für den aktuellen Auftrag

Die vorhandenen Auth-, Membership-, Workspace- und Billing-Schnittstellen bleiben die Grundlage. Änderungen am Domain-Routing, an Tarifnamen und an den Widget-Toolregeln benötigen die noch ausstehenden Nutzervorgaben. Die bestehende nicht committete Arbeit ist vor jeder betroffenen Änderung vollständig zu prüfen.

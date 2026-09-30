# SEO Toolbox – Projektüberblick

Status: in Arbeit

## Zweck

Die SEO Toolbox verwaltet Workspaces, Projekte, SEO-Daten, Issues und asynchrone Jobs. Die vorhandene Produktstruktur ist in `README.md` und `ARCHITECTURE.md` beschrieben.

## Vorhandener Stand

- Die Web-App liegt in `apps/web` und verwendet Next.js.
- Der Worker liegt in `apps/worker`; gemeinsam genutzte Pakete liegen in `packages/`.
- Die Produktionskonfiguration in `DEPLOY.md` und `docker-compose.prod.yml` sieht `seo.nurovelle.de` vor.
- Authentifizierung, Workspace-Mitgliedschaften und Sessions sind bereits implementiert.
- Stripe Checkout, Billing Portal und Webhook liegen unter `apps/web/app/api/billing/`.

## Aktueller Auftrag

Die vom Nutzer beschriebenen Abschnitte 4–6 sehen ein SEO-Widget als Modal auf `detail_seo.html`, eine Preiseseite `/preise` und einen Owner-Zugang vor. Der Nutzer hat angeordnet, die bestehende Architektur beizubehalten und Stripe zu ergänzen. Fehlende Spezifikationen und Routing-Entscheidungen stehen in `todo.md`.

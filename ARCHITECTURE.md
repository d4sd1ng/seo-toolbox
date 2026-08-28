# SEO Toolbox – Datenmodell, Plugin-SDK & IA

Usability-first: ein Projekt, eine Inbox, Module als Plugins.

## 1. Kernidee

```
Workspace
  └── Project (Domain)
        ├── Pages + Crawls
        ├── Keywords + Clusters + Rankings
        ├── Search performance (GSC)
        ├── Issues          ← einzige Arbeitsliste
        └── Jobs            ← alles Langlaufende
```

Module schreiben keine eigenen „Dashboard-Welten“. Sie erzeugen **Pages, Keywords, Jobs, Issues**.

## 2. Prioritätsformel für Issues

```
priorityScore = severityWeight * impact * confidence / effortWeight
```

- severity: critical=5, high=4, medium=3, low=2, info=1
- impact: z.B. Impressions, Volume, InLinks (0–1 normalisiert)
- confidence: 0.4–1.0 (GSC-Daten höher als Heuristik)
- effort: xs=1 … l=4

Die Inbox sortiert danach. User dürfen snoozen/ignorieren – das ist Teil des UX, nicht Datenmüll.

## 3. Navigation (Information Architecture)

Global (ohne Projekt):
- Workspaces / Projekte
- Integrationen (GSC, API-Keys)
- Einstellungen

Im Projekt `/p/:projectId`:

```
Übersicht
Gewinnen
  Keywords
  Rankings
  SERP / Gap
Optimieren
  On-Page
  Content-Brief
  Issues          ← Badge = offene kritische + high
Technik
  Crawl / Audit
  Indexierung
  PageSpeed
Messen
  Search Console
  Backlinks
Einstellungen
```

Command Palette (⌘K) durchsucht Commands aller geladenen Plugins.

## 4. Erste 6 Screens

### Screen 1 – Projekte
Zweck: in <10 Sekunden ins richtige Projekt.

- Karten: Domain, Clicks 28d, offene Issues, letzter Crawl
- Primäraktion: „Projekt anlegen“
- Empty: „Erste Domain verbinden – GSC optional, aber empfohlen“
- Nach Anlegen: Wizard nur 2 Schritte (URL → GSC ja/nein)

### Screen 2 – Projekt-Übersicht
Zweck: Lagebild, keine Tool-Sammlung.

Layout:
- Kopf: Domain, Zeitraum 28/90 Tage, Aktionen [Crawl] [URL prüfen] [Keyword]
- 4 KPIs: Klicks, Impr., Ø Position, offene Issues
- Linke Spalte: Top-Opportunities (max. 7 Issues)
- Rechte Spalte: Ranking-Bewegungen + Job-Status
- Unten: Widgets der Module (klein, klickbar)

Leer ohne GSC: Banner „Search Console verbinden – 2 Minuten, dann echte Zahlen“.

### Screen 3 – On-Page Audit
Zweck: Wow-Effekt + konkrete Fixes.

- Input: URL (Default = Homepage)
- Ergebnis: Score-Ring, 3 Ampel-Gruppen (Index / Snippet / Inhalt)
- Liste: Problem → Ist → Soll → [Issue anlegen]
- Drawer für HTML-Outline und Meta-Vorschau (SERP-Pixel)

Leer: Beispiel-URL vorfüllen.

### Screen 4 – Issues (Herzstück)
Zweck: Arbeit abarbeiten.

Filter: Severity, Modul, Status, Entität
Default-View: Open, sortiert nach priorityScore
Zeile: Severity-Dot, Titel, URL-Pfad, Aufwand, Modul, Alter
Detail-Drawer: Evidenz, Empfehlung, „Als erledigt“, „Snooze 7 Tage“, „Ignorieren“
Bulk: erledigt / ignorieren

Kein zweites Issue-System in anderen Tools.

### Screen 5 – Keywords
Zweck: Cluster statt Excel-Friedhof.

- Links: Cluster-Liste + Ungrouped
- Mitte: Keywords mit Volume, KD, Intent, Position, Ziel-URL
- Rechts: SERP-Mini (nur wenn ein Keyword gewählt)
- Primär: „Recherchieren“, „Aus GSC übernehmen“, „Import CSV“
- Aktion am Keyword: Tracken / Cluster zuordnen / Brief erzeugen

Empty: 3 Einstiege gleichwertig (GSC, Recherche, Import).

### Screen 6 – Crawl / Technik
Zweck: Site-Zustand, nicht 80 Tabs.

- Startzeile: [Crawl starten] Tiefe / JS-Render Toggle / Max URLs
- Summary-Karten: 2xx / 3xx / 4xx / blocked / nicht indexierbar
- Issue-Cluster: Duplicate Titles, Redirect Chains, Orphans …
- Tabelle erst nach Klick auf Cluster
- Sync-Hinweis: „12 neue Issues in die Inbox übernommen“

## 5. Build-Reihenfolge der Entities

1. Workspace, User, Project
2. Integration + Job
3. Page + OnPageAudit
4. Issue
5. SearchPagePerformance
6. Crawl
7. Keyword + RankResult
8. Cluster, SerpSnapshot, ContentBrief

## 6. API-Schnittstellen (minimal)

```
POST /projects
POST /projects/:id/integrations/gsc
POST /jobs                  { type, payload }
GET  /projects/:id/overview
GET  /projects/:id/issues
PATCH /issues/:id
POST /projects/:id/onpage   { url }
POST /projects/:id/crawls
GET  /projects/:id/keywords
```

Jobs sind asynchron. UI pollt `/jobs/:id` oder nutzt SSE.

## 7. Was Core bewusst nicht enthält

- Keine Vendor-Typen von DataForSEO/GSC im Core (Mapper im jeweiligen Plugin)
- Keine PDF-Reports in v1
- Keine Multi-Engine-GEO-Suite
- Kein eigener Backlink-Index

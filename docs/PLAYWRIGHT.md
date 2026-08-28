# Playwright Integration Plan

Ziel: JavaScript-Rendering als **Modus desselben `site_crawl`-Jobs**, nicht als zweites Tool.
HTML-first bleibt Default. Playwright ist teuer, langsam und fehleranfällig – deshalb gezielt, nicht überall.

## 1. Prinzip

```
fetchUrl()          → Roh-HTML, Status, Redirect-Kette   (immer)
maybeRender()       → DOM nach JS, Client-Links, Title   (optional)
extractPage()       → unverändert auf dem HTML, das ankommt
writeCrawlIssues()  → unverändert
```

Playwright ersetzt den Crawler nicht. Es ist ein zweiter Fetcher hinter derselben Schnittstelle `FetchResult`.

## 2. Wann rendern

Nicht jede URL. Reihenfolge:

1. **Off** – Default, `ProjectSettings.renderJavascript = false`
2. **On-demand / Hybrid (v1)** – erst HTTP-Fetch. Nur rendern, wenn die Seite „leer“ wirkt:
   - `wordCount < 80` und Status 200
   - Root ist `#__next`, `#__nuxt`, `#app`, `#root` ohne Inhalt
   - Title ist Framework-Default oder leer
   - viele `<script type="module">`, kaum Text
3. **Full render (v2)** – alle HTML-200-URLs, hartes Limit (z.B. 150/Crawl)
4. **Single URL** – On-Page-Audit kann denselben Renderer nutzen

Hybrid ist der richtige Start: 80–90 % der URLs bleiben billig, JS-Sites werden sichtbar.

## 3. Architektur

```
packages/modules/crawler/src/fetch-url.ts      HTTP, bleibt
packages/modules/crawler/src/render.ts         Playwright-Adapter
packages/modules/crawler/src/browser-pool.ts   1 Browser / Worker-Prozess
```

`FetchResult` um optionale Felder erweitern, Schema von Page/Crawl erst später:

```ts
type FetchResult = {
  // bestehend
  requestedUrl: string;
  finalUrl: string;
  status: number;
  html: string;
  contentType: string;
  chain: RedirectHop[];
  error?: string;
  // neu
  rendered?: boolean;
  rawHtml?: string;          // vor JS
  renderMs?: number;
  renderError?: string;
};
```

`Crawl.renderJavascript` schon vorhanden – beim Job auf den effektiven Modus setzen:
`off | hybrid | full` später als Enum, v1 reicht Boolean + Hybrid-Heuristik.

Worker-Concurrency senken, sobald Render an ist (`WORKER_CONCURRENCY=1` oder 2). Ein Browser pro Worker-Prozess, innen 2–3 Pages max.

## 4. Browser-Pool

- Start: `chromium.launch({ headless: true })` einmal pro Worker
- Context pro Crawl (Cookies/LocalStorage isolieren)
- Page aus dem Context, nach jeder URL `about:blank` + Memory-Cap
- Timeout: 15s Navigation + 5s `networkidle` **nicht** als Pflicht – besser:
  1. `domcontentloaded`
  2. warten bis `body` innerText > N oder max 4s
  3. HTML via `page.content()`
- Blocken: Image, Font, Media, Analytics (`googletagmanager`, `doubleclick`, `hotjar`)
- User-Agent = gleicher Bot-UA wie HTTP-Fetch
- Shutdown: `browser.close()` bei Worker-SIGINT (schon vorhanden)

Kein Playwright in `apps/web`. Nur Worker. Next.js darf das Paket nicht bundlen.

## 5. Redirects vs. Renderer

HTTP-Fetcher bleibt zuständig für Ketten und Statuscodes. Playwright startet erst auf der **finalen** URL nach `fetchUrl()`.

Sonst verlierst du 301-Ketten (Playwright folgt intern und liefert oft nur 200).

Ablauf je URL:

1. `fetchUrl(url)` → Status, Chain, raw HTML
2. Wenn `shouldRender(rawHtml, status, settings)` → `render(finalUrl)`
3. `html` für `extractPage` = gerendertes DOM, `rawHtml` merken
4. Neuer Issue-Typ später: `js_dependent_content` (Text erst nach Render da)

## 6. Settings & Job-Payload

Bereits da:

- `ProjectSettings.renderJavascript`
- `Crawl.renderJavascript`
- API `POST /crawls` um `renderJavascript?: boolean` erweitern

Neu in v1:

```ts
payload: {
  seedUrl, maxUrls,
  renderJavascript: boolean,     // hybrid wenn true
  renderBudget?: number          // max. gerenderte URLs, default 80
}
```

UI: Checkbox „JavaScript rendern (langsam)“ + Hinweis „max. 80 URLs“.

## 7. Budget-Limits (verbindlich)

Zwei getrennte Budgets. Nicht vermischen.

```
crawlBudgetMaxUrls     wie viele URLs HTTP geholt werden   (schon da, default 500, cap 2000)
renderBudget           wie viele davon Playwright sehen    (neu, default 80, cap 150)
renderWallClockMs      wie lange der Browser in diesem Job laufen darf
```

### Harte Caps (Code, nicht nur UI)

| Limit | Default | Cap | Scope |
|---|---|---|---|
| `crawlBudgetMaxUrls` | 500 | 2_000 | Job |
| `renderBudget` | 80 | 150 | Job |
| `renderWallClockMs` | 8 min | 15 min | Job |
| `renderTimeoutMs` | 15_000 | 20_000 | URL |
| `renderWaitMs` | 4_000 | 6_000 | URL, nach DOMContentLoaded |
| HTTP-Concurrency (Render an) | 2 | 3 | Worker |
| Playwright Pages parallel | 2 | 2 | Worker |
| Browser-Prozesse | 1 | 1 | Worker-Prozess |
| On-Page Render | 1 URL | 1 | Job `onpage_audit` |

`min(request, projectSettings, planCap)`. Plan später: free 20, pro 80, agency 150.

### Wann ein Slot verbraucht wird

Zählt gegen `renderBudget` nur wenn Playwright **gestartet** wurde, nicht bei der Heuristik-Prüfung.

Nicht zählen:

- 4xx / 5xx
- Non-HTML
- robots blocked
- `shouldRender() === false`

Zählen auch bei Timeout oder Crash (sonst tight-loop auf derselben kaputten URL).

### Overflow

1. `renderedCount >= renderBudget` → Rest nur HTTP, Job läuft weiter
2. `renderWallClockMs` erreicht → Browser zu, Rest HTTP
3. 3 Render-Fehler in Folge → Render für diesen Job aus (`renderCircuitOpen`)
4. Issue `render_budget_exhausted` (info): „80/80 gerendert, 420 nur HTTP“

Kein Job-Fail nur weil das Render-Budget leer ist. Der Crawl ist trotzdem gültig.

### Priorität der 80 Slots (Hybrid)

Nicht FIFO. Reihenfolge, sobald Kandidaten feststehen:

1. Seed / Homepage
2. URLs mit `internalInLinks` hoch (sobald Graph etwas weiß – zweite Welle am Ende reicht in v1)
3. Heuristik-Treffer (`wordCount < 80`, App-Shell)
4. Rest, bis Budget leer

v1 pragmatisch: Seed zuerst, danach first-come der Heuristik, am Job-Ende bis zu 15 nachträglich die stärksten InLink-URLs nachrendern, wenn Budget übrig.

### Messung am Crawl

An `Crawl` oder Job-`resultSummary` schreiben:

```
rendered: 74
renderSkippedHeuristic: 410
renderBudgetHit: true
renderAvgMs: 2100
renderErrors: 3
```

Ohne diese Zahlen ist das Limit unsichtbar und wird falsch gesetzt.

## 8. Issues, die Playwright erst sinnvoll macht

Nicht in v1 zwingend, aber vorbereiten:

- `js_dependent_content` – raw wordCount niedrig, rendered hoch
- `client_only_links` – Links nur im DOM, nicht im raw HTML
- `render_timeout` – URL nicht gerendert, Budget/Timeout

Bestehende Cluster (4xx, Title, Canonical, Orphans) bleiben. Sie werden mit gerendertem DOM nur genauer.

## 9. On-Page-Audit

Gleicher Adapter, kein zweiter Stack:

- `runOnPageAudit` ruft bei Flag oder Heuristik `render()` auf
- Score getrennt ausweisen: „ohne JS 32 / mit JS 78“ in `metrics` JSON
- Issue nur, wenn die Differenz die Indexierung verändert (Content fehlt Googlebot-ähnlich)

Googlebot rendert, aber nicht wie ein volles User-Chrome. Deshalb Heuristik kommunizieren, nicht „so sieht Google die Seite“.

## 10. Build-Schritte

Erledigt in Code:

1. `playwright` in `module-crawler`
2. `browser-pool.ts` + Worker SIGINT/SIGTERM
3. `shouldRender()` + `renderUrl()`
4. `run-crawl.ts` Hybrid + Monitor
5. Checkbox am Crawl-Form
6. Issues `js_dependent_content`, `render_budget_exhausted`
7. On-Page nutzt denselben Renderer bei dünnem HTML

Offen: Full-Render-Modus, Plan-Caps, Screenshots.

## 11. Was bewusst nicht

- Kein Playwright in der Next-Route
- Kein Screenshot-Service in v1 (später optionales Artifact)
- Kein WAF-Stealth / Wohnungs-Proxies
- Kein Parallel-Crawl HTTP+Render auf derselben URL-Menge ohne Budget
- Kein Ersatz für GSC-Coverage („nicht indexiert, weil JS“) ohne die Heuristik zu labeln

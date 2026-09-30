# CI/CD

Die Workflows liegen unter **`.github/workflows/`** (versteckter Ordner). Ins **Root** des Git-Repos kopieren, nicht nach `apps/web`.

## Ablauf

```
PR          →  CI: pnpm test, Docker-Build (kein Push)
Push main   →  Images → ghcr.io/<org>/<repo>/web|worker:<sha>
            →  wenn ENABLE_DEPLOY=true: VPS-Runner pull && up
Tag v1.2.0  →  dasselbe mit Tag als Image-Version
Manual      →  Actions → Deploy → Run workflow
```

## First-party-Domain und Traefik

Die Produktions-URL lautet `https://seo.nurovelle.de`. Lege den DNS-Eintrag `seo` beim aktiven DNS-Anbieter von `nurovelle.de` an (aktuell Cloudflare) und verweise ihn auf den VPS. Verwende denselben Proxy-Status wie für die Hauptdomain. Solange die Cloudflare-Nameserver aktiv sind, ist IONOS nur der Registrar.

Der Web-Service tritt dem vorhandenen externen Docker-Netzwerk `traefik-network` bei. Docker-Labels konfigurieren den HTTPS-Router für `seo.nurovelle.de` und den vorhandenen Zertifikatsresolver `cloudflare`. Der Web-Container wird nicht direkt an einem Host-Port veröffentlicht.

Setze `NEXT_PUBLIC_APP_URL=https://seo.nurovelle.de` und `GOOGLE_REDIRECT_URI=https://seo.nurovelle.de/api/integrations/gsc/callback` in `/opt/seo-toolbox/.env` auf dem Server.

## Self-hosted Runner auf dem VPS

Der Deploy-Job läuft auf einem Linux-Runner, der ausschließlich für dieses Repository registriert ist und die Labels `self-hosted`, `linux` und `vps` trägt. Der Job ist auf `main` beschränkt; Pull Requests und Feature-Branches deployen nicht. Führe auf diesem Runner keine nicht vertrauenswürdigen Pull-Request-Jobs aus, da sein Benutzer Docker-Zugriff hat.

Die Repository-Variable `ENABLE_DEPLOY` muss auf `true` gesetzt sein. Der Runner kopiert die versionierte Produktions-Compose-Datei nach `/opt/seo-toolbox`, meldet sich mit dem kurzlebigen `GITHUB_TOKEN` bei GHCR an und startet den Stack neu. Ein SSH-Deploy-Key ist nicht erforderlich.

## Server einrichten

Lege `/opt/seo-toolbox/.env` direkt auf dem VPS an. Diese Datei darf nicht committet oder in das Repository hochgeladen werden. Setze mindestens:

```bash
POSTGRES_PASSWORD=<strong URL-safe random value>
ENCRYPTION_KEY=<at least 32 random characters>
NEXT_PUBLIC_APP_URL=https://seo.nurovelle.de
GOOGLE_REDIRECT_URI=https://seo.nurovelle.de/api/integrations/gsc/callback
```

Verwende starke, URL-sichere Zufallswerte. `ENCRYPTION_KEY` muss mindestens 32 Zeichen lang sein; Zugangsdaten werden mit AES-256-GCM verschlüsselt. Optionale Integrationsschlüssel bleiben leer, bis die jeweiligen Integrationen eingerichtet werden.

Die Datei darf nur für den Deploy-Benutzer lesbar sein (`chmod 600`). PostgreSQL und Redis bleiben im privaten Compose-Netzwerk und werden nicht am Host veröffentlicht.

## Prisma

Web-Container startet mit `prisma migrate deploy` (kein `db push`).
SQL muss in Git liegen. Baseline: `sh scripts/prisma-baseline.sh`. Details: `packages/db/MIGRATIONS.md`.


Nach einem Push auf `main`: Die Action **Deploy** muss erfolgreich sein. Prüfe anschließend auf dem VPS mit `docker compose -f docker-compose.prod.yml ps` den Stack und rufe `https://seo.nurovelle.de` auf.

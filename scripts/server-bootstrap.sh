#!/bin/sh
# Einmal auf dem Produktivserver (als Deploy-User).
set -e
APP_DIR="${DEPLOY_PATH:-/opt/seo-toolbox}"
REPO="${1:?Usage: server-bootstrap.sh github_owner/github_repo}"
REPO=$(echo "$REPO" | tr '[:upper:]' '[:lower:]')

mkdir -p "$APP_DIR"
cd "$APP_DIR"

if [ ! -f docker-compose.prod.yml ]; then
  echo "docker-compose.prod.yml nach $APP_DIR kopieren und OWNER ersetzen."
  exit 1
fi

if [ ! -f .env ]; then
  echo "ENCRYPTION_KEY, POSTGRES_PASSWORD, NEXT_PUBLIC_APP_URL in $APP_DIR/.env setzen."
  exit 1
fi

export IMAGE_WEB="ghcr.io/${REPO}/web:latest"
export IMAGE_WORKER="ghcr.io/${REPO}/worker:latest"

if [ -n "${GHCR_TOKEN:-}" ]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "${GHCR_USER:-github}" --password-stdin
fi

docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
echo "Up: $IMAGE_WEB"

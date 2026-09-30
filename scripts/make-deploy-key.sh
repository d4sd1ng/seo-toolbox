#!/bin/sh
# Lokal ausführen, nicht committen. Erzeugt ein Key-Paar nur für GitHub Actions.
set -e
OUT="${1:-$HOME/.ssh/seo-toolbox-deploy}"
mkdir -p "$(dirname "$OUT")"
ssh-keygen -t ed25519 -C "github-actions-deploy" -f "$OUT" -N ""
echo
echo "=== GitHub Secret DEPLOY_SSH_KEY (komplette Datei) ==="
echo "    $OUT"
echo
echo "=== Auf den Server, als Deploy-User ==="
echo "    mkdir -p ~/.ssh && chmod 700 ~/.ssh"
echo "    cat >> ~/.ssh/authorized_keys << 'EOF'"
cat "${OUT}.pub"
echo "EOF"
echo "    chmod 600 ~/.ssh/authorized_keys"
echo
echo "Public Key zum Prüfen:"
cat "${OUT}.pub"

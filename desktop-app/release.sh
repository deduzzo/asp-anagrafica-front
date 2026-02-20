#!/bin/bash
# release.sh - Build e pubblica una nuova versione su GitHub Releases
# Uso: ./release.sh [patch|minor|major] oppure ./release.sh 1.2.3
set -e
cd "$(dirname "$0")"

# --- Determina nuova versione ---
CURRENT=$(node -p "require('./package.json').version")
BUMP="${1:-patch}"

if [[ "$BUMP" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    NEW_VERSION="$BUMP"
else
    IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
    case "$BUMP" in
        major) NEW_VERSION="$((MAJOR+1)).0.0" ;;
        minor) NEW_VERSION="${MAJOR}.$((MINOR+1)).0" ;;
        patch) NEW_VERSION="${MAJOR}.${MINOR}.$((PATCH+1))" ;;
        *) echo "Uso: $0 [patch|minor|major|X.Y.Z]"; exit 1 ;;
    esac
fi

ARCH="arm64"

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  ASP Anagrafica - Release Builder      ║"
echo "╠════════════════════════════════════════╣"
echo "║  Versione corrente: $CURRENT"
echo "║  Nuova versione:    $NEW_VERSION"
echo "╚════════════════════════════════════════╝"
echo ""
read -p "Continuare? [s/N] " CONFIRM
[[ "$CONFIRM" =~ ^[sS]$ ]] || { echo "Annullato."; exit 0; }

# --- 1. Bump versione ---
echo ""
echo "[1/5] Bump versione a $NEW_VERSION..."
node -e "
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# --- 2. Install deps ---
echo "[2/5] Installazione dipendenze..."
npm install --silent

# --- 3. Build ---
echo "[3/5] Build Electron per macOS..."
rm -rf dist
npx electron-builder --mac --publish never 2>&1 | grep -E "^  •|building|packaging"

# --- 4. Commit, tag, push ---
echo "[4/5] Commit e push..."
cd ..
git add desktop-app/package.json
git commit -m "Release v${NEW_VERSION}" --allow-empty
git tag "v${NEW_VERSION}"
git push origin main "v${NEW_VERSION}"
cd desktop-app

# --- 5. GitHub Release ---
echo "[5/5] Creazione release GitHub..."
gh release create "v${NEW_VERSION}" \
    "dist/latest-mac.yml" \
    "dist/ASP-Anagrafica-${NEW_VERSION}-${ARCH}.zip" \
    "dist/ASP-Anagrafica-${NEW_VERSION}-${ARCH}.zip.blockmap" \
    "dist/ASP-Anagrafica-${NEW_VERSION}-${ARCH}.dmg" \
    "dist/ASP-Anagrafica-${NEW_VERSION}-${ARCH}.dmg.blockmap" \
    --title "v${NEW_VERSION}" \
    --notes "Release v${NEW_VERSION}" \
    --latest

echo ""
echo "╔════════════════════════════════════════╗"
echo "║  Release v${NEW_VERSION} pubblicata!   "
echo "╚════════════════════════════════════════╝"
echo ""
echo "Artefatti:"
ls -lh dist/*.{zip,dmg} 2>/dev/null
echo ""
gh release view "v${NEW_VERSION}" --json url --jq '.url'

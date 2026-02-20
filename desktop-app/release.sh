#!/bin/bash
# release.sh - Build macOS + Windows e pubblica su GitHub Releases
# Uso: ./release.sh [patch|minor|major|X.Y.Z]
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

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  ASP Anagrafica - Release Builder           ║"
echo "╠════════════════════════════════════════════╣"
echo "║  Versione corrente: $CURRENT"
echo "║  Nuova versione:    $NEW_VERSION"
echo "║  Piattaforme:       macOS (arm64) + Windows ║"
echo "╚════════════════════════════════════════════╝"
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

# --- 3. Build macOS + Windows ---
echo "[3/5] Build Electron per macOS + Windows..."
rm -rf dist

echo "  [mac] Build in corso..."
npx electron-builder --mac --publish never 2>&1 | grep -E "^  •|building|packaging" || true

echo "  [win] Build in corso..."
npx electron-builder --win --publish never 2>&1 | grep -E "^  •|building|packaging" || true

echo "  Build completate. Artefatti:"
ls -lh dist/*.{zip,dmg,exe,yml} 2>/dev/null || true

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

# Raccogli tutti gli artefatti da caricare
ASSETS=()
for f in dist/latest-mac.yml dist/latest.yml \
         dist/ASP-Anagrafica-*.zip dist/ASP-Anagrafica-*.zip.blockmap \
         dist/ASP-Anagrafica-*.dmg dist/ASP-Anagrafica-*.dmg.blockmap \
         dist/ASP-Anagrafica-*.exe dist/ASP-Anagrafica-*.exe.blockmap; do
    [ -f "$f" ] && ASSETS+=("$f")
done

gh release create "v${NEW_VERSION}" \
    "${ASSETS[@]}" \
    --title "v${NEW_VERSION}" \
    --notes "Release v${NEW_VERSION}" \
    --latest

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║  Release v${NEW_VERSION} pubblicata!        "
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Artefatti:"
ls -lh dist/*.{zip,dmg,exe} 2>/dev/null || true
echo ""
gh release view "v${NEW_VERSION}" --json url --jq '.url'

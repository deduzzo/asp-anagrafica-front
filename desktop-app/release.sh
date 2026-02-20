#!/bin/bash
# release.sh - Build, firma e pubblica una nuova versione
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

ARCH="arm64"

# --- 1. Bump versione ---
echo ""
echo "[1/7] Bump versione a $NEW_VERSION..."
node -e "
const pkg = require('./package.json');
pkg.version = '$NEW_VERSION';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# --- 2. Install deps ---
echo "[2/7] Installazione dipendenze..."
npm install --silent

# --- 3. Build ---
echo "[3/7] Build Electron per macOS..."
rm -rf dist
npx electron-builder --mac --publish never 2>&1 | grep -E "^  •|building|packaging"

APP="dist/mac-arm64/ASP Anagrafica.app"
ZIP="dist/ASP-Anagrafica-${NEW_VERSION}-${ARCH}.zip"
DMG="dist/ASP-Anagrafica-${NEW_VERSION}-${ARCH}.dmg"

# --- 4. Firma ad-hoc ---
echo "[4/7] Firma ad-hoc..."
codesign --force --deep -s - "$APP"
codesign -v "$APP" 2>&1 && echo "  Firma OK" || { echo "  ERRORE firma!"; exit 1; }

# --- 5. Rigenera ZIP con app firmata ---
echo "[5/7] Rigenera ZIP firmato..."
rm -f "$ZIP"
(cd dist/mac-arm64 && ditto -c -k --keepParent "ASP Anagrafica.app" "../ASP-Anagrafica-${NEW_VERSION}-${ARCH}.zip")

# Rigenera latest-mac.yml con hash corretti
ZIP_SHA=$(shasum -a 512 "$ZIP" | awk '{print $1}' | xxd -r -p | base64)
ZIP_SIZE=$(stat -f%z "$ZIP")
DMG_SHA=$(shasum -a 512 "$DMG" | awk '{print $1}' | xxd -r -p | base64)
DMG_SIZE=$(stat -f%z "$DMG")
RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

cat > dist/latest-mac.yml << YAML
version: ${NEW_VERSION}
files:
  - url: ASP-Anagrafica-${NEW_VERSION}-${ARCH}.zip
    sha512: ${ZIP_SHA}
    size: ${ZIP_SIZE}
  - url: ASP-Anagrafica-${NEW_VERSION}-${ARCH}.dmg
    sha512: ${DMG_SHA}
    size: ${DMG_SIZE}
path: ASP-Anagrafica-${NEW_VERSION}-${ARCH}.zip
sha512: ${ZIP_SHA}
releaseDate: '${RELEASE_DATE}'
YAML

# --- 6. Commit, tag, push ---
echo "[6/7] Commit e push..."
cd ..
git add desktop-app/package.json
git commit -m "Release v${NEW_VERSION}" --allow-empty
git tag "v${NEW_VERSION}"
git push origin main "v${NEW_VERSION}"
cd desktop-app

# --- 7. GitHub Release ---
echo "[7/7] Creazione release GitHub..."
gh release create "v${NEW_VERSION}" \
    "dist/latest-mac.yml" \
    "$ZIP" \
    "${ZIP}.blockmap" \
    "$DMG" \
    "${DMG}.blockmap" \
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

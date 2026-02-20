#!/bin/bash
# Build script per ASP Anagrafica Desktop
# Firma ad-hoc + rigenera zip con hash corretti per auto-update
set -e
cd "$(dirname "$0")"

echo "=== Installazione dipendenze ==="
npm install

echo "=== Build Electron (mac) ==="
npx electron-builder --mac --publish never

APP="dist/mac-arm64/ASP Anagrafica.app"
VERSION=$(node -p "require('./package.json').version")
ARCH="arm64"
ZIP="dist/ASP-Anagrafica-${VERSION}-${ARCH}.zip"

echo "=== Firma ad-hoc ==="
codesign --force --deep -s - "$APP"
echo "Firma completata. Verifica:"
codesign -v "$APP" 2>&1 && echo "OK" || echo "ATTENZIONE: verifica fallita"

echo "=== Rigenera ZIP firmato ==="
rm -f "$ZIP"
cd dist/mac-arm64
ditto -c -k --keepParent "ASP Anagrafica.app" "../ASP-Anagrafica-${VERSION}-${ARCH}.zip"
cd ../..

echo "=== Rigenera latest-mac.yml ==="
ZIP_SHA=$(shasum -a 512 "$ZIP" | awk '{print $1}' | xxd -r -p | base64)
ZIP_SIZE=$(stat -f%z "$ZIP")
DMG="dist/ASP-Anagrafica-${VERSION}-${ARCH}.dmg"
DMG_SHA=$(shasum -a 512 "$DMG" | awk '{print $1}' | xxd -r -p | base64)
DMG_SIZE=$(stat -f%z "$DMG")
RELEASE_DATE=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

cat > dist/latest-mac.yml << YAML
version: ${VERSION}
files:
  - url: ASP-Anagrafica-${VERSION}-${ARCH}.zip
    sha512: ${ZIP_SHA}
    size: ${ZIP_SIZE}
  - url: ASP-Anagrafica-${VERSION}-${ARCH}.dmg
    sha512: ${DMG_SHA}
    size: ${DMG_SIZE}
path: ASP-Anagrafica-${VERSION}-${ARCH}.zip
sha512: ${ZIP_SHA}
releaseDate: '${RELEASE_DATE}'
YAML

echo "=== Build completata ==="
echo "Artefatti in dist/:"
ls -lh dist/*.{zip,dmg,yml} 2>/dev/null
echo ""
echo "Per pubblicare: gh release create v${VERSION} dist/latest-mac.yml dist/ASP-Anagrafica-${VERSION}-${ARCH}.zip dist/ASP-Anagrafica-${VERSION}-${ARCH}.zip.blockmap dist/ASP-Anagrafica-${VERSION}-${ARCH}.dmg dist/ASP-Anagrafica-${VERSION}-${ARCH}.dmg.blockmap --title v${VERSION}"

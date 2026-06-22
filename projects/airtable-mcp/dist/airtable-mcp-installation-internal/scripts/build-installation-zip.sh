#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
PACKAGE_NAME="${PACKAGE_NAME:-airtable-mcp-installation-internal}"
STAGE_DIR="$DIST_DIR/$PACKAGE_NAME"
ZIP_FILE="$DIST_DIR/$PACKAGE_NAME.zip"

rm -rf "$STAGE_DIR" "$ZIP_FILE"
mkdir -p "$STAGE_DIR"

copy_path() {
  local path="$1"
  mkdir -p "$STAGE_DIR/$(dirname "$path")"
  cp -R "$ROOT_DIR/$path" "$STAGE_DIR/$path"
}

copy_path "README.md"
copy_path "INSTALL.md"
copy_path "config.example.json"
copy_path "bin"
copy_path "scripts/install-shared-skill-macos.sh"
copy_path "scripts/store-airtable-pat-config-file.sh"
copy_path "scripts/store-airtable-pat-macos.sh"
copy_path "scripts/smoke-test-airtable-mcp.sh"
copy_path "scripts/build-installation-zip.sh"
copy_path "skills/airtable-mcp"

find "$STAGE_DIR" -name ".DS_Store" -delete
find "$STAGE_DIR" -type f -name "*.log" -delete
chmod 755 "$STAGE_DIR/bin/airtable-mcp-keychain-proxy.js"
chmod 755 "$STAGE_DIR/scripts/"*.sh
chmod 755 "$STAGE_DIR/skills/airtable-mcp/scripts/"*.sh

(
  cd "$DIST_DIR"
  zip -Xqr "$ZIP_FILE" "$PACKAGE_NAME"
)

echo "$ZIP_FILE"

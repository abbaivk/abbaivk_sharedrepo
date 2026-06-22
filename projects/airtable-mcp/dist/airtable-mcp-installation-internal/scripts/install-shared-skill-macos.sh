#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"

mkdir -p "$CODEX_HOME/skills" "$CODEX_HOME/bin"

rm -rf "$CODEX_HOME/skills/airtable-mcp"
cp -R "$ROOT_DIR/skills/airtable-mcp" "$CODEX_HOME/skills/airtable-mcp"

cp "$ROOT_DIR/bin/airtable-mcp-keychain-proxy.js" "$CODEX_HOME/bin/airtable-mcp-keychain-proxy"
chmod 700 "$CODEX_HOME/bin/airtable-mcp-keychain-proxy"

cat <<EOF
Installed Airtable MCP skill:
  $CODEX_HOME/skills/airtable-mcp

Installed Airtable MCP proxy:
  $CODEX_HOME/bin/airtable-mcp-keychain-proxy

Add this to $CODEX_HOME/config.toml:

[mcp_servers.airtable]
command = "$CODEX_HOME/bin/airtable-mcp-keychain-proxy"
enabled = true

[mcp_servers.airtable.env]
AIRTABLE_MCP_CONFIG_FILE = "$ROOT_DIR/config.json"

Then run:
  $ROOT_DIR/scripts/store-airtable-pat-config-file.sh

For macOS Keychain storage instead, run:
  $ROOT_DIR/scripts/store-airtable-pat-macos.sh
EOF

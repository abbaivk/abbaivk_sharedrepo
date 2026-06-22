#!/usr/bin/env bash
set -euo pipefail

CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
PROXY="${AIRTABLE_MCP_PROXY:-$CODEX_HOME/bin/airtable-mcp-keychain-proxy}"

if [[ ! -x "$PROXY" ]]; then
  echo "Proxy not found or not executable: $PROXY" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required for this smoke test." >&2
  exit 1
fi

printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"airtable-mcp-smoke-test","version":"0.1.0"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' |
  "$PROXY" |
  jq -r 'select(.id == 2) | .result.tools[].name'

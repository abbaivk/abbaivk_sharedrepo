#!/usr/bin/env bash
set -euo pipefail

SERVICE="${AIRTABLE_MCP_KEYCHAIN_SERVICE:-codex-airtable-mcp-token}"
ACCOUNT="${AIRTABLE_MCP_KEYCHAIN_ACCOUNT:-${USER:-$(id -un)}}"

if ! command -v security >/dev/null 2>&1; then
  echo "macOS security command not found; this script requires macOS Keychain." >&2
  exit 1
fi

printf "Paste Airtable PAT for Keychain service '%s' account '%s': " "$SERVICE" "$ACCOUNT" >&2
restore_echo() {
  stty echo
}
trap restore_echo EXIT
stty -echo
IFS= read -r TOKEN
stty echo
trap - EXIT
printf "\n" >&2

if [[ -z "$TOKEN" ]]; then
  echo "No token provided." >&2
  exit 1
fi

if [[ "$TOKEN" != pat* ]]; then
  echo "The token does not look like an Airtable PAT. Refusing to store it." >&2
  exit 1
fi

/usr/bin/security add-generic-password \
  -U \
  -a "$ACCOUNT" \
  -s "$SERVICE" \
  -w "$TOKEN"

unset TOKEN
echo "Stored Airtable PAT in macOS Keychain service '$SERVICE' for account '$ACCOUNT'."

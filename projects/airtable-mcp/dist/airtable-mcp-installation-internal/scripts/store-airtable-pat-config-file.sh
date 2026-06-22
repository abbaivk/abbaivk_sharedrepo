#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_FILE="${AIRTABLE_MCP_CONFIG_FILE:-$ROOT_DIR/config.json}"
CONFIG_DIR="$(dirname "$CONFIG_FILE")"

mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

printf "Paste Airtable PAT for config file '%s': " "$CONFIG_FILE" >&2
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

if [[ "$TOKEN" == Bearer\ * ]]; then
  TOKEN="${TOKEN#Bearer }"
fi

if [[ "$TOKEN" != pat* ]]; then
  echo "The token does not look like an Airtable PAT. Refusing to store it." >&2
  exit 1
fi

umask 077
CONFIG_FILE="$CONFIG_FILE" TOKEN="$TOKEN" node <<'NODE'
const fs = require("node:fs");
const configFile = process.env.CONFIG_FILE;
const token = process.env.TOKEN;
fs.writeFileSync(
  configFile,
  `${JSON.stringify({ pat: token }, null, 2)}\n`,
  { mode: 0o600 },
);
fs.chmodSync(configFile, 0o600);
NODE

unset TOKEN
echo "Stored Airtable PAT config at '$CONFIG_FILE' with permissions 600."

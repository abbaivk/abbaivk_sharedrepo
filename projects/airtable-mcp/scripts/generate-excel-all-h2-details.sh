#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CODEX_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"

if [[ -n "${NODE_BIN:-}" ]]; then
  NODE="$NODE_BIN"
elif [[ -x "$CODEX_NODE" ]]; then
  NODE="$CODEX_NODE"
else
  NODE="$(command -v node)"
fi

cd "$PROJECT_DIR"
"$NODE" build/extract_all_h2_values_details.mjs

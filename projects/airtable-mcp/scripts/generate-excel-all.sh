#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

"$PROJECT_DIR/scripts/generate-excel-h2-values.sh"
"$PROJECT_DIR/scripts/generate-excel-retain-on-prem.sh"
"$PROJECT_DIR/scripts/generate-excel-all-h2-details.sh"

#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd ~/agent

BACKUP=".safety-backup/build-gate-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP"

cp -a src "$BACKUP/src"
cp -a tests "$BACKUP/tests"
cp package.json "$BACKUP/package.json"

echo "=== AGENT BUILD GATE ==="
echo "[1/4] BACKUP: PASS"

find src -name '*.js' -print0 | xargs -0 -n1 node --check
echo "[2/4] SYNTAX: PASS"

npm test
echo "[3/4] TESTS: PASS"

node - <<'NODE'
const R = require("./src/core/runtime");
const r = new R();
const g = r.connectors.get("gemini");

if (!g || g.metadata.enabled !== false) {
  console.error("SAFETY CHECK FAILED");
  process.exit(1);
}

console.log("[4/4] SAFETY: PASS");
NODE

echo "================================"
echo "BUILD GATE: PASS"
echo "EXTERNAL EXECUTION: CLOSED"
echo "GEMINI: DISABLED"
echo "BACKUP: $BACKUP"
echo "================================"

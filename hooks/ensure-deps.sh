#!/usr/bin/env bash
# SessionStart hook: make sure the bundled FramerExport engine has its deps.
#
# Two cases:
#  - Local skills-dir install: vendor/FramerExport/node_modules already present
#    (installed in place) -> no-op, exits fast.
#  - Marketplace install: the plugin is copied to a read-model cache with NO
#    node_modules committed. Install into ${CLAUDE_PLUGIN_DATA} (persists across
#    updates) by copying the source there and running npm install once, then
#    again only when the engine's package.json changes.
set -e

ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
SRC="$ROOT/vendor/FramerExport"

# Already installed in place (local dev) -> nothing to do.
if [ -d "$SRC/node_modules" ]; then
  exit 0
fi

DATA="${CLAUDE_PLUGIN_DATA:-$ROOT/.data}"
DST="$DATA/FramerExport"
mkdir -p "$DATA"

# (Re)install only when the engine manifest differs from what we last installed.
if ! diff -q "$SRC/package.json" "$DST/package.json" >/dev/null 2>&1; then
  echo "[framer-import] installing FramerExport engine into plugin data dir..."
  rm -rf "$DST"
  mkdir -p "$DST"
  cp -R "$SRC/." "$DST/"
  ( cd "$DST" && npm install --no-audit --no-fund ) || {
    rm -f "$DST/package.json"   # force retry next session on failure
    echo "[framer-import] npm install failed; will retry next session" >&2
    exit 0
  }
fi
exit 0

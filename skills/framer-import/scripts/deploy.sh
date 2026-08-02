#!/usr/bin/env bash
# Robust Vercel deploy: make sure the CLI is installed AND logged in, then ship.
# Usage: bash deploy.sh <siteDir>
#
# Exit codes let the agent react:
#   0 = deployed   2 = needs login (tell user to run `! vercel login`)   1 = error
set -e
SITE="${1:-.}"

# 1) CLI installed?
if ! command -v vercel >/dev/null 2>&1; then
  echo "[deploy] Vercel CLI not found — installing globally (npm i -g vercel)..."
  if ! npm i -g vercel >/dev/null 2>&1; then
    echo "[deploy] ERROR: couldn't install the Vercel CLI. Install it manually: npm i -g vercel" >&2
    exit 1
  fi
fi
echo "[deploy] vercel CLI: $(vercel --version 2>/dev/null | tail -1)"

# 2) Logged in?
if ! vercel whoami >/dev/null 2>&1; then
  echo "[deploy] NEEDS_LOGIN"
  echo "You're not signed into Vercel yet. In the Claude chat, run:"
  echo "    ! vercel login"
  echo "Pick a login method, finish in the browser, then ask me to deploy again."
  exit 2
fi
echo "[deploy] signed in as: $(vercel whoami 2>/dev/null)"

# 3) Deploy to production (non-interactive; first run creates the project)
cd "$SITE"
echo "[deploy] deploying $(pwd) to production..."
vercel deploy --prod --yes

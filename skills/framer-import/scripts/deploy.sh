#!/usr/bin/env bash
# Robust Vercel deploy: make sure the CLI is installed AND logged in, then ship.
# Usage: bash deploy.sh <siteDir> --yes
#
# CONSENT GUARD: this publishes a PUBLIC production deploy. It refuses to run
# unless you pass --yes (or set FRAMER_DEPLOY_CONFIRM=1). Agents must only pass
# --yes after the user has explicitly approved going live.
#
# Exit codes let the agent react:
#   0 = deployed   2 = needs login   3 = needs confirmation   1 = error
set -e

# Parse args: first non-flag is the site dir; --yes confirms.
SITE="."
CONFIRM="${FRAMER_DEPLOY_CONFIRM:-}"
for a in "$@"; do
  case "$a" in
    --yes|-y) CONFIRM=1 ;;
    -*) ;;                       # ignore other flags
    *) SITE="$a" ;;
  esac
done

# 0) Consent gate — do not publish without explicit confirmation.
if [ -z "$CONFIRM" ]; then
  echo "[deploy] NEEDS_CONFIRMATION"
  echo "This publishes '$SITE' as a PUBLIC production deploy on Vercel, using your"
  echo "local Vercel login. Preview it first. Once you've approved going live, re-run:"
  echo "    bash deploy.sh \"$SITE\" --yes"
  exit 3
fi

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
  echo "You're not signed into Vercel yet. Run:  vercel login"
  echo "Pick a login method, finish in the browser, then deploy again."
  exit 2
fi
echo "[deploy] signed in as: $(vercel whoami 2>/dev/null)"

# 3) Deploy to production (confirmed above).
cd "$SITE"
echo "[deploy] deploying $(pwd) to production..."
vercel deploy --prod --yes

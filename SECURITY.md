# Security & consent model

Framer Import runs real actions (a headless browser, package installs, a
production deploy). This documents exactly what runs, when, and what it will not
do without your say-so.

## Nothing runs until you ask for a clone

- **No startup/session side effects.** There is no auto-running session hook. The
  OpenClaw plugin activates on tool use, not at startup (`activation.onStartup:
  false`).
- **Dependencies install lazily.** The exporter engine's dependencies (including a
  headless Chromium) are installed only on the **first actual clone**, by
  `clone-framer.mjs`. Until you run a clone, nothing is installed and nothing is
  downloaded.

## Deploying is gated behind explicit consent

- `deploy.sh` **refuses to publish** unless you pass `--yes` (or set
  `FRAMER_DEPLOY_CONFIRM=1`). Without it, it prints a consent prompt and exits.
- The OpenClaw `framer_deploy` tool has a `confirm` parameter that defaults to
  `false`. The agent must set `confirm: true` — and is instructed to do so only
  after you explicitly approve a public production deploy. This is enforced by the
  tool/script, not just documented.
- Deploys use your **local Vercel login**. The plugin never handles your
  credentials; it shells out to the `vercel` CLI you authenticated.

## What the exporter produces

- The output is a **static mirror** of a published site. To make it self-contained
  the exporter strips CDN-integrity, `crossorigin`, `preconnect`, and CSP `<meta>`
  tags. If you host the output publicly, **add your own Content-Security-Policy and
  related headers** — don't assume the source site's protections carried over.

## Intended use

- Use it only on sites **you own or are licensed to copy** (your own Framer
  projects, or templates you've published/licensed). Don't clone sites you don't
  have rights to.

## What it does not do

- No hidden network calls, exfiltration, or persistence beyond the installed
  engine dependencies. The capabilities (clone, preview, verify, deploy) match the
  stated purpose and are visible in `skills/framer-import/scripts/` and `index.js`.

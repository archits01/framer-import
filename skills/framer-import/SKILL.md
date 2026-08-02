---
name: framer-import
description: >-
  Import (clone) any live Framer site into a self-contained, routed static site
  and deploy it to Vercel (or any static host) — then edit it by prompt and
  re-deploy. Use when someone wants to take a Framer site they like (their own or
  a template they've published), own the code, host it themselves, make changes
  in plain language, and ship again. Wraps the bundled FramerExport engine and
  works around its single-page / CDN-linked limitations, and pairs with the
  `framer-agent-api` skill for the editing half of the loop.
---

# Clone a Framer site, deploy it, prompt changes, re-deploy

The whole point: let anyone point at a **published** Framer URL, get a real
static site they own, host it on Vercel, then say "change the hero to X" and ship
again — without touching Framer's dashboard by hand. This skill is the
orchestration layer over three pieces:

```
  Framer (source of truth)  ──edit──▶  export  ──stitch──▶  deploy
        ▲                                                      │
        └──────────────  "prompt a change"  ◀─────────────────┘
```

- **Edit** — via the `framer-agent-api` skill (drives real canvas/CMS edits
  through `@framer/agent`), then **publish** in Framer so the live URL updates.
- **Export + stitch** — via this skill's scripts (wrapping FramerExport) to pull
  the published site into a routed, fully-localized static bundle.
- **Deploy** — Vercel (or Netlify / Cloudflare Pages / any static host).

## How to run it (the flow)

The person may not be technical, so **drive the flow** and keep it natural — talk
in outcomes (their site, their pages, a link to share), not jargon or raw logs.
The steps below are the shape; use your own words.

1. **Get the URL, confirm it's published.** You can only capture what's live on
   the `*.framer.app`/custom domain — if they just edited in Framer, have them
   Publish first.
2. **Clone it** (`ensure-deps.sh` if needed, then `clone-framer.mjs`). These are
   local and safe — just do them, with a light progress line, not a permission ask.
3. **Preview before deploying.** Serve + `verify.mjs`, then **screenshot** the
   homepage (and a key page) so they can *see* it's right. Trust comes from
   showing, not claiming.
4. **Confirm, then deploy.** Deploying is public — ask first. Then run
   `deploy.sh` (it installs the Vercel CLI if missing and detects login state).
5. **Lead with the live URL**, then verify it in production (fetch a few routes /
   screenshot) so "it's live and it works" comes with proof.
6. **Be honest, then offer next steps** — flag anything that ships imperfect
   (template-filler pages, forms that no-op until repointed), then offer custom
   domain / rename / edits.

**Non-negotiables:** publish-before-clone · preview-before-deploy ·
confirm-before-public · always show the live URL · verify with a real render, not
just an HTTP 200 (a 200 can be the homepage fallback — see `gotchas.md`).

**Handle these gracefully:** site not published → stop, ask them to publish;
Vercel CLI missing or not logged in → `deploy.sh` handles it (see below);
bot-protected site (Cloudflare/captcha) → the engine fails loudly, tell them it
can't be auto-captured rather than shipping empty; a route fails `verify.mjs`
(`[DUP-OF-HOME]` or failed requests) → never deploy it, diagnose first; single-
page site (no routes discovered) → fine, deploy the one page; only ever clone a
site they own or a template they've published/licensed.

## Prerequisites

1. **The FramerExport engine is BUNDLED** at the plugin root `vendor/FramerExport/`
   (captures Framer sites — MIT-licensed, vendored so the plugin is self-contained
   and doesn't depend on the upstream repo staying up). Its deps + a puppeteer
   Chromium install **lazily, on the first clone only** — `clone-framer.mjs` runs
   `hooks/ensure-deps.sh` when it finds no engine. Nothing installs at startup or
   session time. To pre-install manually:
   ```bash
   bash "${CLAUDE_PLUGIN_ROOT}/hooks/ensure-deps.sh"
   ```
   In sandboxes that block postinstall scripts, a matching Chromium is often
   already at `~/.cache/puppeteer/chrome/...`; otherwise
   `npx puppeteer browsers install chrome`.
2. **Node 18+**. 3. **A PUBLISHED Framer URL** (e.g. `https://xxx.framer.app`).
   The exporter captures what is **published**, not unpublished canvas edits — so
   always publish in Framer first.
4. For deploy: the **Vercel CLI** (`npm i -g vercel`) or the Vercel dashboard.

## The one-command clone

`clone-framer.mjs` auto-locates the bundled engine (via `CLAUDE_PLUGIN_ROOT` /
`CLAUDE_PLUGIN_DATA`, or the vendored copy), so run it from anywhere. Override
with `FEXPORT=/path/to/FramerExport` to point at a different checkout.

```bash
SITE_URL=https://xxx.framer.app node "${CLAUDE_PLUGIN_ROOT}/skills/framer-import/scripts/clone-framer.mjs" ./my-site
```

This does everything: exports the homepage, **discovers every internal route**
from its links, **exports each route individually** (so each page's assets are
localized — not left on Framer's CDN), **stitches** them into one routed tree
with `<base href="/">`, builds a localized **404**, and writes **vercel.json**.

## Verify (the trust moment)

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/framer-import/scripts/serve.mjs" ./my-site 4000 &
node "${CLAUDE_PLUGIN_ROOT}/skills/framer-import/scripts/verify.mjs" http://localhost:4000 ./my-site
```

`verify.mjs` asserts each route shows its **own** content (not a homepage
fallback) and loads with **zero failed requests** — the two things that are
silently broken if you rely on the exporter alone. Then **screenshot** the
homepage (headless) and show it before deploying — let them see it's right.

## Deploy to Vercel

Use the helper — it makes deploy work even for someone who has **never used
Vercel**: it installs the CLI if it's missing, checks login state, and ships:

```bash
# --yes is REQUIRED to publish. Only pass it AFTER the user approves going live.
bash "${CLAUDE_PLUGIN_ROOT}/skills/framer-import/scripts/deploy.sh" ./my-site --yes
```

- **Exit 3 = needs confirmation.** Without `--yes` the script refuses to publish
  and prints the consent prompt. This is intentional — never bypass it; get the
  user's ok, then re-run with `--yes`.
- **Exit 2 = needs login.** The script prints the instruction; relay it: have
  them run `! vercel login` in the chat (the `!` prefix runs it in their session,
  browser-based), then deploy again.
- **Exit 0 = deployed.** The output prints two URLs: a long deployment URL (often
  behind Vercel's deployment-protection for their account) and a short **aliased**
  URL like `https://<project>-xi.vercel.app` — the **public** one to share.

After deploying, **verify in production**: fetch a few routes (`/`, a cleanUrl
like `/pricing`, a nested one like `/legal/privacy-policy`, and a bogus path for
the 404) and confirm the right titles + `200`/`404`. Optionally screenshot the
live homepage.

Re-deploys are just `deploy.sh` (or `vercel --prod`) again. Offer a **custom
domain** (`vercel domains add <domain>` + DNS, or the dashboard) and a nicer
**project name** (dashboard) as follow-ups. Other hosts work too — see
`reference/edit-redeploy-loop.md` (Netlify `_redirects`, Cloudflare Pages, etc.).

## Why not just use FramerExport directly?

Because it doesn't actually produce a working multi-page site. See
`reference/gotchas.md` — the short version:

- One run = **one page**. `--subpages` exists but leaves sub-pages **CDN-linked
  and unrouted** (`/pricing` serves the homepage). This skill exports **per
  route** and routes them properly.
- Relative asset paths **break on nested routes** (`/legal/x`). Fixed with a
  single injected `<base href="/">`.
- The `/404` route returns HTTP 404, so the exporter skips it — built separately.

## The edit → re-deploy loop

Once cloned and deployed, a change request flows like this (details in
`reference/edit-redeploy-loop.md`):

0. **First time editing only:** connect the agent to Framer —
   `npx @framer/agent@latest setup` (Node ≥ 24) + copy the project link. This is a
   **one universal setup** (same for Claude Code / Codex / Cursor / Antigravity;
   the CLI auto-detects the tool). See https://www.framer.com/agents/external/.
1. Make the edit in Framer via the **`framer-agent-api`** skill.
2. **Publish** in Framer (`framer.agent.publish`) so the live URL reflects it.
3. Re-run `clone-framer.mjs` (same command) to re-pull the published site.
4. `vercel --prod` again.

**Don't over-ask:** cloning + deploying needs **no** Framer account or setup —
only a published URL. The `@framer/agent setup` + project connection is required
**only** for the prompt-driven *editing* half, and only once. For content-only
tweaks you can sometimes patch the static HTML directly, but the durable source of
truth is Framer — prefer edit-in-Framer → re-export.

## Reference

- `reference/gotchas.md` — FramerExport's limitations and the exact fixes.
- `reference/edit-redeploy-loop.md` — wiring this to `framer-agent-api`, plus
  what does/doesn't survive as a static snapshot (forms, CMS, analytics), and
  non-Vercel deploy targets.
- `scripts/` — `clone-framer.mjs`, `serve.mjs`, `verify.mjs`, `deploy.sh` (all
  parameterized; no hard-coded site).

# Framer Import

**Turn any published Framer site into code you own — cloned, deployed, and
editable by prompt — without touching a dashboard.**

You point it at a Framer URL. It pulls the whole site down into a clean, static,
self-contained website, checks every page renders, shows you a preview, and ships
it to Vercel (or any static host). Later you just say *"change the pricing to $29"* —
it makes the edit in Framer, republishes, re-pulls, and re-deploys. That's the
whole loop, driven from plain language.

```
  Framer (your design)  ──edit by prompt──▶  import  ──▶  your live site
         ▲                                                      │
         └───────────────────  "change X"  ◀────────────────────┘
```

Works as a plugin in **Claude Code · Codex · Cursor · Antigravity · Hermes ·
OpenClaw** — all six live-verified. One folder, one shared engine. The
`framer-agent-api` skill and the `@archits01/framer-import` plugin are also
**published on [ClawHub](https://clawhub.ai)**. Then just talk to your agent.

---

## Why this exists

Framer is great for designing, but the moment you want to **own the code**, **host
it yourself**, **drop the Framer subscription**, or **fold the site into your own
infra**, you're stuck — Framer doesn't hand you a clean export.

The popular export tools get you *one page*, still wired to Framer's CDN, with no
routing. Visiting `/pricing` shows the homepage. Framer Import fixes all of that:
it exports **every route**, localizes **every asset**, wires up **real routing +
a 404**, and gives you a folder you can deploy anywhere and keep forever.

---

## Quickstart

Once installed (see [Install](#install)), you don't run scripts — you **talk to
your agent**:

> **You:** import https://my-site.framer.app and deploy it

That's it. The agent handles the rest and hands you a live URL. Under the hood
it runs the same three steps you *can* run by hand if you want
([power-user mode](#power-user--manual-usage)):

```bash
# 1. clone every route into a self-contained static site
SITE_URL=https://my-site.framer.app node .../scripts/clone-framer.mjs ./my-site
# 2. verify every page renders with zero broken assets
node .../scripts/serve.mjs ./my-site 4000 &   node .../scripts/verify.mjs http://localhost:4000 ./my-site
# 3. ship it
bash .../scripts/deploy.sh ./my-site
```

---

## What the experience feels like

A real run, from your chair:

1. **You:** *"import https://my-site.framer.app and deploy it"*
2. **Agent:** "On it — I'll clone every page, check it all renders, show you a
   preview, then deploy. Give me a couple minutes."
3. *(agent clones all routes, localizes assets, verifies)*
4. **Agent:** "✅ Cloned all 9 pages — every one renders, zero broken assets.
   Here's the homepage 👇 [screenshot]. Ready to put it live?"
5. **You:** *"yep"*
6. **Agent:** *(if you've never used Vercel)* "Quick one-time login — run
   `! vercel login` and tell me when you're in." → then deploys.
7. **Agent:** "🎉 **It's live: https://my-site-xi.vercel.app** — I checked the
   home, pricing, and 404 in production, all good. Heads up: your *Blog* page
   still has template filler, and the contact form won't submit until we point it
   somewhere. Want a custom domain, or to fix either of those?"

No jargon, no terminal walls — just a preview, a link, and honest next steps.

---

## Install

Pick your agent. Each is verified working; the skills and engine are identical
across all four.

First, clone it somewhere:
```bash
git clone https://github.com/archits01/framer-import.git
```

### Claude Code
Drop it into `~/.claude/skills/` — it auto-loads as a skills-directory plugin,
no install step.
```bash
git clone https://github.com/archits01/framer-import.git ~/.claude/skills/framer-import
# restart Claude Code (or /reload-plugins), then:
claude plugin list        # shows: framer-import@skills-dir  ✔ loaded
```

### Codex
Install straight from GitHub:
```bash
codex plugin marketplace add archits01/framer-import
codex plugin add framer-import@framer-import-marketplace
codex plugin list         # shows: installed, enabled
```

### Cursor
```bash
mkdir -p ~/.cursor/plugins/local
ln -sfn /path/to/framer-import ~/.cursor/plugins/local/framer-import
# then in Cursor: "Developer: Reload Window"
# or ad hoc:  cursor-agent --plugin-dir /path/to/framer-import
```

### Antigravity
```bash
agy plugin install /path/to/framer-import
agy plugin list           # shows: framer-import (skills)
```

### Hermes
Install from GitHub, then enable (plugins are opt-in):
```bash
hermes plugins install archits01/framer-import --enable
hermes plugins list       # shows: framer-import  enabled
```
Adds a `/framer-import` slash command (`clone <url>` / `deploy [dir]` / `help`)
and registers both skills (load with `skill_view("framer-import:framer-import")`).

### OpenClaw
A **native** OpenClaw plugin (`index.js` + `openclaw.plugin.json`) exposing two
tools — `framer_clone` and `framer_deploy` — that drive the shared scripts +
engine. Install from ClawHub or locally:
```bash
openclaw plugins install clawhub:@archits01/framer-import   # from ClawHub
# or local:  openclaw plugins install ./framer-import
openclaw plugins inspect framer-import --runtime            # Status: loaded · Tools: framer_clone, framer_deploy
```
Verified: loads in-process, both tools register. The `framer_clone` tool runs
`ensure-deps.sh` itself, so the engine's deps install on first use.

### ClawHub
```bash
clawhub skill install framer-agent-api          # the editing skill (text)
clawhub package install @archits01/framer-import # the clone/deploy plugin
```

> **First run installs the engine's dependencies** (a headless-browser download)
> automatically via the plugin's `SessionStart` hook. To trigger it manually:
> `bash /path/to/framer-import/hooks/ensure-deps.sh`

---

## Requirements

- **Node.js 18+** for the clone/deploy engine. *(Node 24+ only if you use the
  prompt-editing half — see below.)*
- A **published** Framer site — the live `*.framer.app` or your custom domain.
  The engine captures what's *published*, so publish before you import.
- For deploying: the **Vercel CLI** — but you don't need to pre-install it; the
  bundled `deploy.sh` installs it and walks you through `vercel login` if needed.
  (Any static host works too — Netlify, Cloudflare Pages, S3.)
- **No Framer account or setup is needed to clone + deploy.** It's only required
  for the *editing* half (next section).

---

## Editing your site by prompt

After it's deployed, changing it is a sentence:

> **You:** *"change the hero headline to 'Ship faster' and redeploy"*

The agent uses the bundled **`framer-agent-api`** skill to make the real edit on
your Framer canvas, publishes it, re-clones, and re-deploys. The loop:

```
edit in Framer  →  publish  →  re-clone  →  verify  →  redeploy
```

**One-time setup for editing only:** connect your agent to Framer with
`npx @framer/agent@latest setup` (needs Node 24+) and copy your project link.
This is a *single universal setup* — the same for Claude Code, Codex, Cursor, and
Antigravity (the CLI auto-detects your tool). See
<https://www.framer.com/agents/external/>. If you only want to clone + host your
site, you can skip this entirely.

---

## What carries over — and what doesn't

Your clone is a **static snapshot**. Framer stays the source of truth.

| ✅ Works perfectly | ⚠️ Needs attention |
| :-- | :-- |
| All layout, styling, fonts, images, animations | **Forms** — Framer forms POST to Framer's backend; repoint to Formspree / your API / a serverless function |
| Every route + a real custom 404 | **CMS live updates** — content is frozen at export; re-import to refresh |
| Client interactions, hover/scroll effects | **Framer Analytics / A-B tests** — stripped; add your own (Vercel/Plausible) |
| SEO meta + Open Graph tags | **Password-gated pages** — not exportable |
| Custom code components (compiled into the bundle) | **Anything hitting Framer's runtime APIs** |

The agent will call out whatever ships imperfect (template-filler pages, forms)
so nothing surprises you later.

---

## Power-user / manual usage

Everything the agent does, you can run yourself. The scripts are plain Node/bash,
take a `SITE_URL` and paths, and self-locate the bundled engine.

```bash
P=/path/to/framer-import/skills/framer-import/scripts

# clone: exports every route, localizes assets, stitches routing, builds 404, writes vercel.json
SITE_URL=https://my-site.framer.app node "$P/clone-framer.mjs" ./my-site

# preview locally (mimics Vercel cleanUrls + 404 fallback)
node "$P/serve.mjs" ./my-site 4000

# verify: headless-renders every route, asserts distinct content + zero failed requests
node "$P/verify.mjs" http://localhost:4000 ./my-site

# deploy: installs Vercel CLI if missing, handles login, ships to prod
bash "$P/deploy.sh" ./my-site
```

Env knobs: `SITE_URL` (required), `OUT_DIR`, `ROUTES` (force-include extra
routes), `FEXPORT` (point at a different FramerExport checkout).

---

## How it works under the hood

The generic export tools fall short in three ways; the engine fixes each:

1. **One page per run** → it discovers every internal route from the homepage and
   exports each one individually, so every page's assets are fully localized.
2. **Broken routing** (`/pricing` serves the homepage) → each page is stitched
   into a real routed tree with an injected `<base href="/">`, so even nested
   routes like `/legal/privacy` resolve correctly.
3. **No 404 / CDN leftovers** → it builds a localized custom 404 and strips
   editor/badge/tracking, then writes a `vercel.json` (cleanUrls + rewrites).

It **verifies by actually rendering** each route in a headless browser (a plain
`200` can be a homepage fallback), which is the real ship gate.

---

## Troubleshooting

| Symptom | Fix |
| :-- | :-- |
| "site not published" / empty capture | Publish in Framer first; the engine captures the live URL only. |
| Cloudflare / captcha error | The site is bot-protected and can't be auto-captured — it fails loudly rather than shipping an empty site. |
| Deploy says "not logged in" | Run `vercel login` (or `! vercel login` in-agent), then deploy again. |
| A route shows the homepage | Routing/asset issue — re-run the clone; `verify.mjs` catches this before deploy. |
| Engine "no node_modules" | Run `bash hooks/ensure-deps.sh`. |

---

## Project structure

```
framer-import/
├── plugin.json                      # Antigravity manifest (root marker)
├── plugin.yaml + __init__.py        # Hermes plugin (register skills + /framer-import command)
├── openclaw.plugin.json + index.js + package.json  # OpenClaw native plugin (framer_clone/framer_deploy tools)
├── .claude-plugin/plugin.json       # Claude Code manifest
├── .codex-plugin/plugin.json        # Codex manifest (+ interface metadata)
├── .cursor-plugin/plugin.json       # Cursor manifest
├── .agents/plugins/marketplace.json # Codex marketplace catalog
├── hooks/{hooks.json, ensure-deps.sh}
├── skills/
│   ├── framer-import/               # clone → stitch → deploy → re-deploy
│   │   ├── SKILL.md
│   │   ├── reference/{gotchas, edit-redeploy-loop}.md
│   │   └── scripts/{clone-framer.mjs, serve.mjs, verify.mjs, deploy.sh}
│   └── framer-agent-api/            # edit a Framer project via @framer/agent
│       ├── SKILL.md
│       └── reference/{dsl, gotchas, recipes}.md
├── vendor/FramerExport/             # the capture engine (MIT; deps installed at runtime)
└── LICENSE · CHANGELOG.md · .gitignore
```

All six harnesses read the same `skills/<name>/SKILL.md`; the scripts self-locate
the engine, so the exact same code runs everywhere.

---

## Attribution

Bundles [FramerExport](https://github.com/danbenba/FramerExport) (MIT, © danbenba)
as the capture engine — see `vendor/FramerExport/LICENSE`.

## License

MIT © 2026 Archit Sakri. See `LICENSE`.

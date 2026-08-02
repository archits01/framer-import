# Framer Import

Clone a published Framer site into a static site you actually own, deploy it, and
change it later by just telling your agent what to do.

It runs as a plugin (or skill) in Claude Code, Codex, Cursor, Antigravity, Hermes,
and OpenClaw, and it's on [ClawHub](https://clawhub.ai) as `@archits01/framer-import`.

## What it does

You give it a published Framer URL. It downloads the whole site (every page, all
the images and fonts) into a plain static folder, checks the pages render, and
deploys it to Vercel or wherever you want. Later, if you want to change something,
you say so in plain English and it edits the Framer project, republishes, re-pulls,
and redeploys.

None of what you clone stays tied to Framer. The output is just HTML/CSS/JS you
can host anywhere and keep.

## Why

Framer is good for building, but it won't hand you a clean export. The existing
export tools grab one page, leave the assets pointed at Framer's CDN, and don't
set up routing, so visiting `/pricing` ends up serving the homepage. This exports
every route, pulls every asset local, wires up real routing and a custom 404, and
gives you a folder you can deploy and forget about.

## Quickstart

You don't run scripts. You tell your agent:

> import https://my-site.framer.app and deploy it

It clones the site, shows you a preview so you can check it looks right, asks
before it puts anything live, then hands you the URL. If you'd rather run it
yourself, it's three steps (see [manual usage](#manual-usage)):

```bash
SITE_URL=https://my-site.framer.app node .../scripts/clone-framer.mjs ./my-site
node .../scripts/verify.mjs http://localhost:4000 ./my-site   # after serving it
bash .../scripts/deploy.sh ./my-site --yes   # --yes is required to publish
```

## Install

Grab it:

```bash
git clone https://github.com/archits01/framer-import.git
```

Then wire it into whichever agent you use. The skills and engine are the same
everywhere; only the manifest each tool reads differs.

**Claude Code** — drop it in `~/.claude/skills/` and it loads on its own:
```bash
git clone https://github.com/archits01/framer-import.git ~/.claude/skills/framer-import
claude plugin list        # framer-import@skills-dir, loaded
```

**Codex** — install from GitHub:
```bash
codex plugin marketplace add archits01/framer-import
codex plugin add framer-import@framer-import-marketplace
```

**Cursor** — symlink it into the local plugins folder, then reload the window:
```bash
mkdir -p ~/.cursor/plugins/local
ln -sfn /path/to/framer-import ~/.cursor/plugins/local/framer-import
```

**Antigravity**:
```bash
agy plugin install /path/to/framer-import
```

**Hermes** — installs from GitHub, opt-in so you enable it after:
```bash
hermes plugins install archits01/framer-import --enable
```
Gives you a `/framer-import` command (`clone <url>`, `deploy [dir]`, `help`).

**OpenClaw / ClawHub** — a native plugin with two tools, `framer_clone` and
`framer_deploy`:
```bash
openclaw plugins install clawhub:@archits01/framer-import
```

The first clone downloads the engine's dependencies (it uses a headless browser).
That happens lazily, on the first clone only — nothing installs at startup. You
can also trigger it yourself with `bash hooks/ensure-deps.sh`.

Deploys need explicit confirmation: `deploy.sh` won't publish without `--yes`, and
the OpenClaw `framer_deploy` tool won't unless `confirm: true`. See
[SECURITY.md](SECURITY.md).

## What you need

- Node 18+ for cloning and deploying. (Node 24+ only if you also want the
  edit-by-prompt part.)
- A Framer site that's actually published. It captures the live URL, so publish
  before you import.
- For deploys, the Vercel CLI, but you don't have to install it first; `deploy.sh`
  handles that and the login. Any static host works too (Netlify, Cloudflare
  Pages, S3).

You don't need a Framer account or any setup just to clone and host a site. That's
only for editing (below).

## Editing by prompt

Once it's up, changing it is one sentence:

> change the hero headline to "Ship faster" and redeploy

It makes the edit on your Framer canvas, publishes, re-clones, and redeploys.

The only setup for this half is connecting your agent to Framer once, with
`npx @framer/agent@latest setup` (needs Node 24+) plus your project link. It's the
same setup for every agent. See https://www.framer.com/agents/external/. If you're
only cloning and hosting, skip it.

## What carries over, and what doesn't

A clone is a snapshot. Framer stays the source of truth.

Carries over: all the layout, styling, fonts, images, and animations; every route
plus a real 404; hover/scroll effects and other client-side stuff; SEO and Open
Graph tags; custom code components (they compile into the bundle).

Doesn't, without a bit of work:

- Forms. Framer forms post to Framer's backend. Repoint them at Formspree, your
  own API, or a serverless function.
- CMS content is frozen at export time. Re-import to refresh it.
- Framer analytics and A/B tests get stripped. Add your own.
- Password-gated pages and anything that hits Framer's runtime APIs won't come
  across.

The agent flags whatever ships imperfect (leftover template pages, dead forms) so
you're not surprised later.

## Manual usage

Everything the agent does is just these scripts. They take a `SITE_URL` and paths
and find the bundled engine themselves.

```bash
P=/path/to/framer-import/skills/framer-import/scripts

# clone every route, localize assets, set up routing + 404 + vercel.json
SITE_URL=https://my-site.framer.app node "$P/clone-framer.mjs" ./my-site

# serve locally the way Vercel would (cleanUrls + 404 fallback)
node "$P/serve.mjs" ./my-site 4000

# render every route headless and check it's the right page with no broken assets
node "$P/verify.mjs" http://localhost:4000 ./my-site

# deploy (installs the Vercel CLI if missing, handles login)
bash "$P/deploy.sh" ./my-site
```

Extra env vars: `OUT_DIR`, `ROUTES` (force extra routes to include), `FEXPORT`
(point at a different FramerExport checkout).

## How it works

The generic export tools fall short in a few ways; this works around each:

- They do one page per run. This reads the homepage links, finds every internal
  route, and exports each one on its own so all the assets end up local.
- Routing breaks (`/pricing` serves the homepage). Each page gets stitched into a
  proper routed tree with a `<base href="/">` so even nested routes like
  `/legal/privacy` resolve.
- No 404, and editor/badge/tracking left in. It builds a real localized 404,
  strips that stuff, and writes a `vercel.json` with cleanUrls and rewrites.

It checks the result by actually rendering each route in a headless browser rather
than trusting an HTTP 200 (a 200 can just be the homepage fallback). That render
check is the gate before it deploys anything.

## Troubleshooting

- "Site not published" or an empty capture: publish in Framer first. It can only
  see the live URL.
- Cloudflare or a captcha: the site is bot-protected and can't be captured. It
  fails loudly instead of shipping an empty site.
- Deploy says you're not logged in: run `vercel login` and deploy again.
- A route shows the homepage: routing/asset problem. Re-run the clone; `verify.mjs`
  catches this before you deploy.
- Engine says no `node_modules`: run `bash hooks/ensure-deps.sh`.

## Layout

```
framer-import/
├── plugin.json                      Antigravity manifest
├── plugin.yaml + __init__.py        Hermes plugin (skills + /framer-import command)
├── openclaw.plugin.json + index.js + package.json   OpenClaw native plugin (framer_clone/framer_deploy)
├── .claude-plugin/plugin.json       Claude Code
├── .codex-plugin/plugin.json        Codex
├── .cursor-plugin/plugin.json       Cursor
├── .agents/plugins/marketplace.json Codex marketplace catalog
├── hooks/ensure-deps.sh            (installs the engine on first clone; no auto-run)
├── skills/
│   ├── framer-import/               clone, deploy, redeploy
│   │   ├── SKILL.md
│   │   ├── reference/{gotchas, edit-redeploy-loop}.md
│   │   └── scripts/{clone-framer.mjs, serve.mjs, verify.mjs, deploy.sh}
│   └── framer-agent-api/            edit a Framer project via @framer/agent
│       ├── SKILL.md
│       └── reference/{dsl, gotchas, recipes}.md
├── vendor/FramerExport/             the capture engine (MIT; deps installed at runtime)
└── LICENSE, CHANGELOG.md, .gitignore
```

Every agent reads the same `skills/<name>/SKILL.md`, and the scripts locate the
engine on their own, so the same code runs everywhere.

## Credits

Uses [FramerExport](https://github.com/danbenba/FramerExport) (MIT, © danbenba) as
the capture engine. See `vendor/FramerExport/LICENSE`.

## License

MIT © 2026 Archit Sakri.

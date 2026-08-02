# The edit → re-deploy loop

The clone is a **static snapshot**. The durable source of truth stays in Framer.
A change request should almost always flow: edit in Framer → publish → re-export
→ re-deploy. This keeps the code and the Framer project from diverging.

## Two halves have different requirements — don't over-ask

- **Clone + deploy** (the `framer-import` flagship) needs **nothing from Framer's
  agent** — no account link, no `@framer/agent setup`. It just captures a
  **published URL**. So never make someone run the Framer setup just to clone or
  re-deploy.
- **Edit by prompt** (the `framer-agent-api` half) is the only part that needs a
  **connected Framer project**. Gate the setup here, and only the first time.

## Step 0 (edit path only, one-time): connect the agent to Framer

Before the *first* prompt-driven edit — not before cloning — make sure the agent
is connected to Framer:

1. Run **`npx @framer/agent@latest setup`** (ensure Node ≥ 24 first). This is the
   **same universal setup prompt for every agent** (Claude Code, Codex, Cursor,
   Antigravity) — the CLI auto-detects the tool and installs the skills to
   `~/.agents/skills` (+ `~/.claude/skills` for Claude Code). Framer's page for it:
   https://www.framer.com/agents/external/
2. **Connect the project**: new thread → copy the Framer **project link** (browser
   address bar with the project open, or right-click the project tab → "Copy
   Project Link").

If the user only wants to clone/host their site, skip all of this.

## The loop (once connected)

```
0. SETUP     (first time only, edit path) npx @framer/agent@latest setup + connect project
1. EDIT      framer-agent-api skill drives the change on the Framer canvas/CMS
2. PUBLISH   framer.agent.publish  (the live *.framer.app URL now reflects it)
3. RE-CLONE  SITE_URL=... node scripts/clone-framer.mjs ./my-site   (idempotent)
4. VERIFY    node scripts/serve.mjs ./my-site & node scripts/verify.mjs
5. DEPLOY    cd ./my-site && vercel --prod
```

Steps 3–5 are the same every time and safe to re-run — `clone-framer.mjs` rebuilds
the output dir from scratch, so there's no stale state to clean up.

## Editing: use the `framer-agent-api` skill

That companion skill covers the mechanics (DSL, `replaceText`, component
variants, CMS, the non-obvious gotchas). Two rules that matter for this loop:

- **Publish after editing.** Canvas edits via `applyChanges` do NOT change the
  published URL until `framer.agent.publish`. If you re-export before publishing,
  you capture the OLD site and wonder why nothing changed.
- **Verify the export reflects the edit.** After re-cloning, grep the built HTML
  for the thing you changed (e.g. the new hero text) before deploying — the
  cheapest way to confirm publish→export actually propagated.

## Fast path: patch the static HTML directly (use sparingly)

For a tiny copy tweak you can edit the built `*.html` and redeploy without a
round-trip to Framer. But the next full re-clone **overwrites** it — so anything
you want to keep must also be made in Framer. Prefer edit-in-Framer for anything
you care about surviving.

## What survives as a static snapshot — and what doesn't

| Works after cloning | Broken / needs wiring |
|---|---|
| All layout, styling, fonts, images, animations | **Form submissions** (Framer forms POST to Framer's backend — repoint to Formspree / your API / a serverless function) |
| Client-side interactions, page nav, hover/scroll effects | **CMS live updates** (content is frozen at export time; re-export to refresh) |
| SEO meta, Open Graph (exporter optimizes these) | **Framer Analytics / A-B tests** (stripped; add your own, e.g. Vercel/Plausible) |
| Custom code components (they compile into the page bundle) | **Password protection / gated pages** (not exportable) |
| Multiple routes + a real 404 (via this skill) | **Search / anything hitting Framer's runtime APIs** |

Call these out to the user when they clone — especially forms, which look fine but
silently no-op until repointed.

## Deploy targets (all static-host friendly)

- **Vercel** — `vercel --prod` from the site dir; `vercel.json` (written by the
  clone) gives `cleanUrls` + nested rewrites. Or connect a git repo for
  push-to-deploy.
- **Netlify** — `netlify deploy --prod --dir .`; add a `_redirects` file if you
  want the 404 fallback (`/* /404.html 404`).
- **Cloudflare Pages / GitHub Pages / S3+CloudFront** — plain static upload; keep
  the folder structure and 404.html.

## Turning this into a distributable plugin

To ship as a Claude Code / Codex plugin so others can do "clone this Framer site
and deploy it":

- Bundle **three skills** together: `framer` (base session/exec), `framer-agent-api`
  (editing mechanics), and this one (`framer-clone-deploy`).
- Vendor or `postinstall`-clone **FramerExport** so the exporter + Chromium are
  present.
- Expose a slash command / entry prompt like *"clone <framer-url> and deploy"* that
  runs `clone-framer.mjs` → `verify.mjs` → `vercel --prod`, then offers the edit
  loop. Keep the scripts parameterized (they already take `SITE_URL` / paths) so
  nothing is hard-coded to one project.

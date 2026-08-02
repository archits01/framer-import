# Changelog

## 0.5.0

- **OpenClaw — native plugin, VERIFIED + published on ClawHub.** Added a native
  OpenClaw plugin: `index.js` (`defineToolPlugin`) exposing `framer_clone` /
  `framer_deploy` tools that drive the shared scripts + engine, plus
  `openclaw.plugin.json` + `package.json` (`openclaw.extensions`). Runtime-verified
  with the OpenClaw CLI (`openclaw plugins install` → `inspect --runtime`:
  Status loaded, both tools registered). Doesn't affect the other five (Claude
  validate + Antigravity validate still pass).
- **Published on ClawHub:** `framer-agent-api@1.0.0` (skill) and
  `@archits01/framer-import@0.5.0` (code-plugin).
- **Added Hermes (fifth target, VERIFIED).** Added a root `plugin.yaml` +
  `__init__.py` — Hermes uses a Python `register(ctx)` plugin model but the *same*
  `SKILL.md` skill format, so both skills register unchanged via
  `ctx.register_skill`, plus a `/framer-import` slash command
  (`clone <url>` / `deploy [dir]` / `help`) that runs the shared scripts and
  lazily installs the engine deps. Discovered + enabled by the Hermes CLI
  (`hermes plugins`); the root `plugin.yaml`/`__init__.py` don't affect the other
  four (Claude Code validate, Codex list, Antigravity validate all still pass).

## 0.4.0

- **Added Cursor (VERIFIED).** Added `.cursor-plugin/plugin.json`. All harnesses
  share the same `skills/<name>/SKILL.md` format, so the two skills work unchanged.
  `cursor-agent --plugin-dir` loads the plugin and both skills register. Local
  install: symlink into `~/.cursor/plugins/local/`. (Cursor also supports
  `rules/*.mdc` and `mcp.json`, unused here.)
- **Antigravity: added and VERIFIED.** Added a root `plugin.json` (Antigravity's
  required marker; coexists with the subdir manifests). `agy plugin validate` +
  `agy plugin install` both pass — it reads the nested `skills/<name>/SKILL.md`
  (2 skills processed) and stages the full plugin incl. the engine; engine
  resolves and puppeteer launches from the Antigravity stage. (Its optional
  `hooks.json`/`mcp_config.json` formats differ but aren't needed.)

## 0.3.0

- **Dual-target: now a Codex plugin too.** Added `.codex-plugin/plugin.json`
  (with Codex `interface` metadata) alongside `.claude-plugin/plugin.json`, and a
  `.agents/plugins/marketplace.json` catalog so Codex can `plugin marketplace add`
  and install it. Skills, hooks, scripts, and the vendored engine are shared —
  Codex sets `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` for compat and the scripts
  self-locate the engine, so nothing else changed.
- Made the **one-time Framer connect step** explicit and correctly scoped: the
  clone+deploy half needs no Framer account; the prompt-editing half needs
  `npx @framer/agent@latest setup` + a connected project (a single universal setup
  for all agents). Documented in `SKILL.md`, `edit-redeploy-loop.md`, and the
  `framer-agent-api` skill.

## 0.2.0

- Baked the **deploy step + flow** into the flagship skill (kept lean — natural
  flow via principles in `SKILL.md`, no separate phrasebook):
  - A concise "How to run it" flow: URL → clone → preview+screenshot → confirm →
    deploy → verify → honest caveats/next steps, with non-negotiables
    (publish-before-clone, preview-before-deploy, confirm-before-public, verify by
    real render) and inline edge-case handling.
  - **`scripts/deploy.sh`** — robust Vercel deploy for someone who's never used
    Vercel: installs the CLI if missing, detects login (exit 2 → prompt
    `! vercel login`), then ships with non-interactive `--yes`.

## 0.1.0

Initial release.

- `framer-import` skill: clone any published Framer site into a self-contained,
  routed static site and deploy to Vercel / any static host.
  - Per-route export (fully localized assets), `<base href="/">` stitching for
    correct nested-route resolution, localized 404, `vercel.json` generation.
  - `clone-framer.mjs`, `serve.mjs`, `verify.mjs` (all parameterized).
- `framer-agent-api` skill: edit a Framer project via `@framer/agent` — the
  `applyChanges` DSL, `replaceText`, component variants, CMS, and the non-obvious
  gotchas, for the prompt-a-change → re-import → re-deploy loop.
- Bundles the FramerExport engine (MIT) under `vendor/`; deps install at runtime
  via a `SessionStart` hook into `${CLAUDE_PLUGIN_DATA}`.

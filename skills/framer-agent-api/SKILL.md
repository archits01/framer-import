---
name: framer-agent-api
description: >-
  Edit an existing Framer website programmatically via the @framer/agent CLI —
  canvas layout, copy/text, component instances & variants, CMS, code
  components, images, and publishing. Use when a user wants to change, audit, or
  restructure a live Framer project (identified by a framer.com/projects URL or
  project name) rather than build one by hand. Contains the DSL syntax and the
  hard-won gotchas (rich-text staleness, control-clearing, variant propagation,
  strikethrough, image upload) that are NOT obvious from the base docs.
---

# Editing Framer sites through the agent API

A field-tested playbook for driving real edits into an existing Framer project
with `npx @framer/agent@latest`. It ships **alongside the base `framer` skill**
(bundled in the same package): the base skill provides the foundation —
`session new`, `exec`, `apply-changes`, `docs`, and the generated project
inventory — and this companion skill layers on **the practical mechanics and the
bugs you only learn by hitting them**, none of which are spelled out in the base
docs. Load the base skill for setup/session basics; reach here the moment you're
actually mutating nodes.

## Prerequisite: connect the agent to Framer (one-time)

Before any edit, the base `framer` skill must be installed and a project
connected:

1. `npx @framer/agent@latest setup` (needs Node ≥ 24). This is the **same
   universal setup for every agent** — Claude Code, Codex, Cursor, Antigravity —
   the CLI auto-detects the tool and installs to `~/.agents/skills`
   (+ `~/.claude/skills` for Claude Code). Ref: https://www.framer.com/agents/external/
2. Connect the project: `npx @framer/agent session new "<project url or id>"`, or
   copy the project link (browser address bar, or right-click the project tab →
   "Copy Project Link").

If setup hasn't run, `framer.agent.*` calls won't work — do this first.

## Mental model

A Framer project is a tree of **nodes**, each with a stable **id**. You edit by:

1. **Reading** the tree with `framer.agent.getNode` / `getDescendantsOfTypes` /
   `getAncestors` / `serialize` to find the id you want.
2. **Mutating** it with `framer.agent.applyChanges(dsl, {pagePath})` (a compact
   DSL) or `framer.agent.replaceText(...)` for in-place copy.
3. **Verifying** by re-reading the node — never trust a screenshot alone
   (they cache and render stale).

Everything runs inside `exec` scripts so you can loop, traverse, and branch.
Reuse **one session** (`-s <id>`) for the whole conversation so edits stay on one
branch and `state` persists.

```bash
npx @framer/agent@latest session new "<url or project id>"   # once
npx @framer/agent@latest exec -s <id> <<'FRAMER_EXEC'
  const n = await framer.agent.getNode({ id: "<nodeId>" }, { pagePath: "/" });
  console.log(n.type, getInnerText(n));
FRAMER_EXEC
```

## The core loop: find → change → verify

Every edit follows the same shape. Find the node, apply the smallest change,
read it back:

```bash
npx @framer/agent@latest exec -s <id> <<'FRAMER_EXEC'
// 1. FIND — walk a subtree collecting candidates by text/attribute
const root = await framer.agent.getNode({ id: "<sectionId>" }, { pagePath: "/" });
const hits = [];
(function walk(n){
  const a = n.attributes || {};
  const text = Object.values(a).filter(v => typeof v === "string").join(" ");
  if (/some text you're hunting/i.test(text)) hits.push({ id: n.id, type: n.type, a });
  for (const c of (n.children || [])) walk(c);
})(root);
console.log(JSON.stringify(hits, null, 1));

// 2. CHANGE
await framer.agent.applyChanges('SET <nodeId> $control__text="New label"', { pagePath: "/" });

// 3. VERIFY (read back, do not rely on a screenshot)
const after = await framer.agent.getNode({ id: "<nodeId>" }, { pagePath: "/" });
console.log(after.attributes.$control__text);
FRAMER_EXEC
```

`getInnerText(node)` and `walkWithSkipChildren(...)` are VM globals available
inside `exec` for local traversal of already-serialized trees — no extra API
round-trips.

## Reference files (read on demand)

- **`reference/dsl.md`** — the full `applyChanges` mini-language: `SET`, `DEL`,
  `MOVE`, `DUPE`, node-creation (`+FrameNode`, `+RichTextNode`, `+TextRun`,
  `+IconNode`, `+ComponentInstanceNode`), the `pagePath` option, and how node
  ids / ground-node prefixes work.
- **`reference/gotchas.md`** — the non-obvious failures and their fixes:
  clearing a control (empty string doesn't work — use `"null"`), rich-text
  virtual-child staleness, component variant/replica propagation, editing
  invisible component-definition variants, strikethrough vs text-style presets,
  new-frame default height, stale screenshots, `getRect` origin artifacts.
- **`reference/recipes.md`** — bigger building blocks: images
  (`uploadImage` with a base64 data URL), CMS (`addItems`, slugs, image = URL
  string, date-field binding via `ComputedValue`/`toDateString`), code
  components (`createCodeFile` / `setFileContent`, array-control defaults,
  animated-number components with a hidden text fallback), and local image prep.

## Rules that save you every time

- **One session, reused.** Creating a second session mid-task can spawn a
  second branch when auto-branching is on.
- **Read before you write.** Fetch the node in the *same* `exec` right before
  editing it — ids inside rich text (`v:<id>:0:0`) go stale between calls.
- **Verify by re-reading the node, not by screenshot.** On-demand screenshots
  render from cache and lie. Re-`getNode` the field you changed.
- **Prefer `framer.agent.*` over low-level plugin APIs** for design/layout/CMS.
  Reach for raw `framer.*` only where there's no agent equivalent (code files,
  localization, redirects).
- **Make the smallest change.** `SET` one attribute, verify, move on. Batch only
  once a pattern is proven — a broken batch is far harder to unwind.
- **Confirm before adding/removing content the user didn't explicitly ask for**,
  and always before destructive actions.

## Publishing

When the site is ready, `framer.agent.publish` (or the CLI `publish`) pushes a
deployment. Offer a preview publish so the user can eyeball changes before going
live. When output includes `[FRAMER_BRANCH_CHANGE]`, tell the user the branch
changed and surface the `url`.

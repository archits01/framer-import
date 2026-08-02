// OpenClaw native plugin entry for Framer Import.
// Exposes framer_clone / framer_deploy tools that drive the shared scripts +
// bundled FramerExport engine. The same skills/ and engine are reused by the
// Claude Code / Codex / Cursor / Antigravity / Hermes builds of this repo.
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS = path.join(ROOT, "skills", "framer-import", "scripts");

function run(cmd, args, env) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: "utf-8",
    env: { ...process.env, ...(env || {}) },
    maxBuffer: 32 * 1024 * 1024,
  });
  let out = r.stdout || "";
  if (r.status !== 0 && r.stderr) out += "\n[stderr]\n" + r.stderr;
  return out.trim() || "(no output)";
}

export default defineToolPlugin({
  id: "framer-import",
  name: "Framer Import",
  description:
    "Clone any published Framer site into a self-contained, routed static site you own, then deploy it to Vercel or any static host.",
  tools: (tool) => [
    tool({
      name: "framer_clone",
      description:
        "Clone a PUBLISHED Framer site into a routed, fully-localized static site directory (every route, assets localized, custom 404, vercel.json).",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["url"],
        properties: {
          url: {
            type: "string",
            description: "Published Framer URL, e.g. https://your-site.framer.app",
          },
          outDir: {
            type: "string",
            description: "Output directory for the static site (default: ./framer-site)",
          },
        },
      },
      execute: async ({ url, outDir }) => {
        const out = outDir || "./framer-site";
        run("bash", [path.join(ROOT, "hooks", "ensure-deps.sh")]); // ensure engine deps
        const log = run("node", [path.join(SCRIPTS, "clone-framer.mjs"), out], { SITE_URL: url });
        return { outDir: out, log: log.slice(-6000) };
      },
    }),
    tool({
      name: "framer_deploy",
      description:
        "Deploy a cloned static site directory to Vercel (installs the Vercel CLI if missing; reports the live URL).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          dir: {
            type: "string",
            description: "Site directory produced by framer_clone (default: ./framer-site)",
          },
        },
      },
      execute: async ({ dir }) => {
        const site = dir || "./framer-site";
        const log = run("bash", [path.join(SCRIPTS, "deploy.sh"), site]);
        return { dir: site, log: log.slice(-6000) };
      },
    }),
  ],
});

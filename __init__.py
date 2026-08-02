"""framer-import — Hermes plugin.

Clone any published Framer site into a self-contained, routed static site you own,
deploy it (Vercel / any static host), and edit it by prompt then re-deploy.

This file is the Hermes wiring only. The actual capability lives in the shared
``skills/`` (same SKILL.md format Hermes uses) and ``vendor/FramerExport`` engine,
which are also consumed by the Claude Code / Codex / Cursor / Antigravity builds of
this same repo. Hermes installs the whole repo to ``~/.hermes/plugins/framer-import/``,
so the paths below resolve inside the installed plugin directory.
"""
from __future__ import annotations

import logging
import os
import shlex
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parent
_SKILLS = _ROOT / "skills"
_SCRIPTS = _SKILLS / "framer-import" / "scripts"
_ENGINE = _ROOT / "vendor" / "FramerExport"

_HELP = """\
/framer-import — clone a published Framer site into code you own and deploy it.

  /framer-import help                    show this
  /framer-import clone <url> [out-dir]   clone a published Framer URL (default: ./framer-site)
  /framer-import deploy [dir]            deploy a cloned site dir to Vercel

For the full guided flow (preview, verify, edit-by-prompt), load the skill:
  skill_view("framer-import:framer-import")

Requires Node.js 18+. The first clone auto-installs the engine's dependencies.
"""


def _ensure_engine_deps() -> str | None:
    """Install the FramerExport engine's node deps in place if missing.

    Returns an error string on failure, else None. The repo ships the engine
    source only (node_modules is gitignored), so a fresh install needs this once.
    """
    if (_ENGINE / "node_modules").exists():
        return None
    if not (_ENGINE / "package.json").exists():
        return f"engine not found at {_ENGINE}"
    logger.info("framer-import: installing engine dependencies (first run)…")
    p = subprocess.run(
        ["npm", "install", "--no-audit", "--no-fund"],
        cwd=str(_ENGINE), text=True, capture_output=True,
    )
    if p.returncode != 0:
        return "engine dependency install failed:\n" + (p.stderr or "")[-800:]
    return None


def _run(cmd: list[str], env: dict | None = None) -> str:
    p = subprocess.run(
        cmd, cwd=str(_ROOT), text=True, capture_output=True,
        env={**os.environ, **(env or {})},
    )
    out = (p.stdout or "")
    if p.returncode != 0 and p.stderr:
        out += "\n[stderr]\n" + p.stderr
    return out.strip() or "(no output)"


def _handle_slash(raw_args: str) -> str | None:
    argv = shlex.split(raw_args.strip()) if raw_args else []
    if not argv or argv[0] in {"help", "-h", "--help"}:
        return _HELP

    sub = argv[0]

    if sub == "clone":
        if len(argv) < 2:
            return "usage: /framer-import clone <framer-url> [out-dir]"
        err = _ensure_engine_deps()
        if err:
            return err
        url = argv[1]
        out = argv[2] if len(argv) > 2 else "./framer-site"
        return _run(["node", str(_SCRIPTS / "clone-framer.mjs"), out], env={"SITE_URL": url})

    if sub == "deploy":
        site = argv[1] if len(argv) > 1 else "./framer-site"
        return _run(["bash", str(_SCRIPTS / "deploy.sh"), site])

    return f"unknown subcommand: {sub}\n\n{_HELP}"


def register(ctx) -> None:
    """Wire the two shared skills + a ``/framer-import`` slash command into Hermes.

    Called once when the plugin is enabled via ``plugins.enabled`` in config.yaml.
    """
    for name in ("framer-import", "framer-agent-api"):
        skill_md = _SKILLS / name / "SKILL.md"
        if skill_md.exists():
            ctx.register_skill(name, skill_md, description=f"{name} — Framer Import")

    ctx.register_command(
        "framer-import",
        handler=_handle_slash,
        description="Clone a Framer site into code you own and deploy it.",
        args_hint="clone <url> [out] | deploy [dir] | help",
    )

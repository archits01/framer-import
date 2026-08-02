#!/usr/bin/env node
/*
 * clone-framer.mjs — Clone a LIVE Framer site into a routed, self-contained
 * static site ready for Vercel/Netlify/any static host.
 *
 * Why this exists: the FramerExport tool exports ONE url per run, and its
 * --subpages flag captures sub-pages but leaves them CDN-linked and unrouted
 * (visiting /pricing shows the homepage). This script drives the tool per-route
 * so every page is fully localized, then stitches them into one routed tree.
 *
 * Usage (run from inside your FramerExport checkout so puppeteer + tsx resolve):
 *   SITE_URL=https://your-site.framer.app node /path/to/clone-framer.mjs [outDir]
 *
 * Env:
 *   SITE_URL   (required)  the published framer.app (or custom-domain) URL
 *   FEXPORT    (optional)  path to FramerExport checkout; defaults to cwd
 *   OUT_DIR    (optional)  output site dir; defaults to ./framer-site or argv[2]
 *   ROUTES     (optional)  comma-separated extra routes to force-include
 *
 * Output: a folder with index.html, <route>.html, nested legal/*.html, shared
 * assets/ scripts/ styles/ data/, a localized 404.html, and vercel.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Resolve deps (puppeteer) from the FramerExport install, not this script's dir.
const requireFrom = (dir) => createRequire(path.join(dir, 'noop.cjs'));

const SITE_URL = process.env.SITE_URL;
if (!SITE_URL) {
  console.error('ERROR: set SITE_URL=https://your-site.framer.app');
  process.exit(1);
}
// Locate the FramerExport engine (must have node_modules). Order:
//   $FEXPORT  >  $CLAUDE_PLUGIN_DATA/FramerExport (marketplace install)  >
//   <plugin-root>/vendor/FramerExport (local skills-dir install)
const __dir = path.dirname(fileURLToPath(import.meta.url)); // .../skills/framer-import/scripts
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || path.resolve(__dir, '..', '..', '..');
const candidates = [
  process.env.FEXPORT,
  process.env.CLAUDE_PLUGIN_DATA && path.join(process.env.CLAUDE_PLUGIN_DATA, 'FramerExport'),
  path.join(PLUGIN_ROOT, 'vendor', 'FramerExport'),
].filter(Boolean);
const hasDeps = (d) => fs.existsSync(path.join(d, 'node_modules'));
let FEXPORT = candidates.find(hasDeps);
// Lazy, on-demand dependency install: nothing is installed until you actually
// run a clone. (No startup/session hook does this behind your back.)
if (!FEXPORT) {
  const setup = path.join(PLUGIN_ROOT, 'hooks', 'ensure-deps.sh');
  if (fs.existsSync(setup)) {
    console.error('[framer-import] first run: installing the exporter engine (one-time)…');
    spawnSync('bash', [setup], { stdio: 'inherit' });
    FEXPORT = candidates.find(hasDeps);
  }
}
if (!FEXPORT) {
  console.error(
    `ERROR: FramerExport engine has no node_modules. Tried:\n  ${candidates.join('\n  ')}\n` +
      `Run the setup manually:  bash "${path.join(PLUGIN_ROOT, 'hooks', 'ensure-deps.sh')}"`
  );
  process.exit(1);
}
const OUT = path.resolve(process.env.OUT_DIR || process.argv[2] || 'framer-site');
const EX = path.resolve('_ex');
const ORIGIN = new URL(SITE_URL).origin;
const SHARED = ['assets', 'scripts', 'styles', 'data'];

// Safety: the stitch step wipes OUT to rebuild it. Only ever delete a dir this
// tool created (marked) or that is empty — refuse to destroy a pre-existing dir
// we don't own, so a mistaken OUT_DIR can't nuke someone's files. Checked up
// front (before any export work). Override with FRAMER_FORCE=1.
const OUT_MARKER = path.join(OUT, '.framer-import');
if (
  fs.existsSync(OUT) &&
  !fs.existsSync(OUT_MARKER) &&
  fs.readdirSync(OUT).length > 0 &&
  process.env.FRAMER_FORCE !== '1'
) {
  console.error(
    `ERROR: "${OUT}" already exists and was not created by framer-import.\n` +
      `Refusing to overwrite it. Use a new/empty directory, or set FRAMER_FORCE=1 to override.`
  );
  process.exit(1);
}

// ---- helpers ---------------------------------------------------------------

function runExport(url, outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  const r = spawnSync('node', ['--import', 'tsx', 'src/cli/index.ts', url, outDir], {
    cwd: FEXPORT,
    encoding: 'utf-8',
    timeout: 5 * 60 * 1000,
  });
  return fs.existsSync(path.join(outDir, 'index.html'));
}

// route path ("/pricing", "/legal/x") -> output file ("pricing.html", "legal/x.html")
function routeToFile(route) {
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  if (clean === '') return 'index.html';
  return clean + '.html';
}
function routeToSlug(route) {
  const clean = route.replace(/^\//, '').replace(/\/$/, '');
  return clean === '' ? 'home' : clean.replace(/\//g, '__');
}

// discover same-origin internal routes from an exported homepage HTML
function discoverRoutes(homeHtml) {
  const found = new Set();
  const re = /href="((?:\.?\/)[^"#?]*)"/g;
  let m;
  while ((m = re.exec(homeHtml))) {
    let href = m[1];
    if (href.startsWith('./')) href = href.slice(1); // "./x" -> "/x"
    if (!href.startsWith('/')) continue;
    if (/\.(png|jpe?g|svg|webp|avif|css|js|mjs|woff2?|ttf|otf|ico|mp4|webm|json)$/i.test(href))
      continue;
    if (href === '/' || href === '') continue;
    found.add(href.split('#')[0].split('?')[0]);
  }
  return [...found];
}

function copyMerge(src, dst) {
  if (!fs.existsSync(src)) return 0;
  let n = 0;
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      fs.mkdirSync(d, { recursive: true });
      n += copyMerge(s, d);
    } else if (!fs.existsSync(d)) {
      // Framer uses content-hashed filenames => same name == same bytes => safe merge
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      n++;
    }
  }
  return n;
}

// <base href="/"> makes every relative asset + nav link resolve from root at ANY
// url depth (critical for nested routes like /legal/x). Also strips editor/badge.
function processHtml(html) {
  let out = html
    .replace(/<script[^>]*framer\.com\/edit\/init\.mjs[^>]*><\/script>/gi, '')
    .replace(/<script[^>]*events\.framer\.com[^>]*><\/script>/gi, '')
    .replace(/<div id="__framer-badge-container"[\s\S]*?<\/div>/gi, '');
  if (!/<base\s/i.test(out)) out = out.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="/">`);
  return out;
}

// ---- 1. export homepage + discover routes ----------------------------------

console.log(`\n[1/5] Exporting homepage: ${SITE_URL}`);
fs.mkdirSync(EX, { recursive: true });
if (!runExport(SITE_URL, path.join(EX, 'home'))) {
  console.error('FAILED to export homepage. Check the URL is published and reachable.');
  process.exit(1);
}
const homeHtml = fs.readFileSync(path.join(EX, 'home', 'index.html'), 'utf-8');
let routes = discoverRoutes(homeHtml);
if (process.env.ROUTES) routes.push(...process.env.ROUTES.split(',').map((r) => r.trim()));
routes = [...new Set(routes)].filter((r) => r && r !== '/404');
console.log(`      Discovered ${routes.length} routes: ${routes.join(', ') || '(none)'}`);

// ---- 2. export each route individually -------------------------------------

console.log(`\n[2/5] Exporting ${routes.length} routes individually...`);
const ok = { '/': 'home' };
for (const route of routes) {
  const slug = routeToSlug(route);
  process.stdout.write(`      ${route} ... `);
  if (runExport(ORIGIN + route, path.join(EX, slug))) {
    ok[route] = slug;
    console.log('ok');
  } else {
    console.log('SKIPPED (no index.html — page may 404 or be gated)');
  }
}

// ---- 3. stitch into routed site --------------------------------------------

console.log(`\n[3/5] Stitching into ${OUT}`);
fs.rmSync(OUT, { recursive: true, force: true }); // safe: validated up front
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(OUT_MARKER, 'created by framer-import\n');
for (const d of SHARED) fs.mkdirSync(path.join(OUT, d), { recursive: true });

let totalAssets = 0;
for (const [route, slug] of Object.entries(ok)) {
  const exDir = path.join(EX, slug);
  for (const d of SHARED) totalAssets += copyMerge(path.join(exDir, d), path.join(OUT, d));
  const html = processHtml(fs.readFileSync(path.join(exDir, 'index.html'), 'utf-8'));
  const file = route === '/' ? 'index.html' : routeToFile(route);
  const dst = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, html, 'utf-8');
}
console.log(`      ${Object.keys(ok).length} pages, ${totalAssets} shared assets merged`);

// ---- 4. build localized 404 (best-effort, needs puppeteer) -----------------

console.log(`\n[4/5] Building 404.html`);
try {
  const puppeteer = requireFrom(FEXPORT)('puppeteer');
  const index = new Map();
  (function idx(dir, url) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) idx(p, url + '/' + e.name);
      else if (!index.has(e.name)) index.set(e.name, url + '/' + e.name);
    }
  })(path.join(OUT, 'assets'), '/assets');
  ['scripts', 'styles'].forEach((d) =>
    (function idx(dir, url) {
      if (!fs.existsSync(dir)) return;
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) idx(p, url + '/' + e.name);
        else if (!index.has(e.name)) index.set(e.name, url + '/' + e.name);
      }
    })(path.join(OUT, d), '/' + d)
  );

  const b = await puppeteer.launch({ headless: 'new' });
  const pg = await b.newPage();
  await pg.goto(ORIGIN + '/404', { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 2500));
  let html = await pg.evaluate(() => {
    document
      .querySelectorAll(
        '[id^="__framer-editorbar"], #__framer-badge-container, iframe[src*="framer.com/edit"], script[src*="framer.com/edit"], script[src*="events.framer.com"]'
      )
      .forEach((el) => el.remove());
    return '<!DOCTYPE html>' + document.documentElement.outerHTML;
  });
  await b.close();

  const cdnRe = /https?:\/\/(?:[a-z]+\.)?framer(?:usercontent|static)?\.com\/[^\s"')]+/g;
  for (const u of [...new Set(html.match(cdnRe) || [])]) {
    const base = u.split('?')[0].split('/').pop();
    let local = base && index.has(base) ? index.get(base) : null;
    if (!local) {
      try {
        const res = await fetch(u);
        if (res.ok) {
          const dest = path.join(OUT, 'assets', 'misc', base);
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
          local = '/assets/misc/' + base;
          index.set(base, local);
        }
      } catch {}
    }
    if (local) html = html.split(u).join(local);
  }
  if (!/<base\s/i.test(html)) html = html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="/">`);
  // pull in any localized module graph the tool downloaded for /404
  copyMerge(path.join(EX, 'notfound', 'scripts'), path.join(OUT, 'scripts'));
  copyMerge(path.join(EX, 'notfound', 'assets'), path.join(OUT, 'assets'));
  fs.writeFileSync(path.join(OUT, '404.html'), html, 'utf-8');
  console.log('      404.html written');
} catch (e) {
  console.log('      skipped 404 (' + e.message + ')');
}

// ---- 5. vercel.json --------------------------------------------------------

console.log(`\n[5/5] Writing vercel.json`);
const nested = Object.keys(ok)
  .filter((r) => r.slice(1).includes('/'))
  .map((r) => ({ source: r, destination: routeToFile(r).replace(/^/, '/') }));
fs.writeFileSync(
  path.join(OUT, 'vercel.json'),
  JSON.stringify({ cleanUrls: true, trailingSlash: false, rewrites: nested }, null, 2)
);

console.log(`\nDONE. Static site at: ${OUT}`);
console.log(`Verify:  node scripts/serve.mjs ${OUT}   then  node scripts/verify.mjs`);
console.log(`Deploy:  cd ${OUT} && vercel --prod`);

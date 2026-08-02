#!/usr/bin/env node
/*
 * verify.mjs — headless render-check every route of a served clone. Confirms each
 * page shows its OWN content (not the homepage) and loads with ZERO failed
 * requests (i.e. fully self-contained, no CDN leftovers). Run from a dir where
 * `puppeteer` resolves (your FramerExport checkout).
 *   node verify.mjs [baseUrl] [siteDir]   (defaults: http://localhost:4000, ./framer-site)
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const BASE = process.argv[2] || 'http://localhost:4000';
const SITE = path.resolve(process.argv[3] || 'framer-site');
// Resolve puppeteer from FramerExport (env FEXPORT) or cwd, not this script's dir.
const FEXPORT = process.env.FEXPORT || process.cwd();
const requirePuppeteer = () => createRequire(path.join(FEXPORT, 'noop.cjs'))('puppeteer');

// derive route list from the site's html files
const routes = ['/'];
(function walk(dir, prefix) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory() && !['assets', 'scripts', 'styles', 'data'].includes(e.name))
      walk(path.join(dir, e.name), prefix + '/' + e.name);
    else if (e.isFile() && e.name.endsWith('.html') && e.name !== 'index.html') {
      const r = (prefix + '/' + e.name.replace(/\.html$/, '')).replace(/^\/+/, '/');
      if (r !== '/404') routes.push(r);
    }
  }
})(SITE, '');

const puppeteer = requirePuppeteer();
const b = await puppeteer.launch({ headless: 'new' });
const seenH1 = new Map();
let allGood = true;
for (const route of routes) {
  const pg = await b.newPage();
  await pg.setViewport({ width: 1440, height: 900 });
  let failed = 0;
  pg.on('requestfailed', () => failed++);
  await pg.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 1200));
  const info = await pg.evaluate(() => ({
    h1: (document.querySelector('h1') || {}).innerText || '',
    len: document.body.innerText.length,
  }));
  const dup = route !== '/' && info.h1 && seenH1.get('/') === info.h1; // same h1 as home => routing broken
  if (route === '/') seenH1.set('/', info.h1);
  const good = failed === 0 && info.len > 50 && !dup;
  if (!good) allGood = false;
  console.log(`${good ? '✓' : '✗'} ${route.padEnd(30)} failedReq=${failed} ${dup ? '[DUP-OF-HOME]' : ''} h1=${JSON.stringify(info.h1.slice(0, 40))}`);
  await pg.close();
}
await b.close();
console.log(allGood ? '\nALL ROUTES CLEAN ✓' : '\nISSUES FOUND ✗ (see rows above)');
process.exit(allGood ? 0 : 1);

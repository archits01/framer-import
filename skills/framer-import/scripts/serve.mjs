#!/usr/bin/env node
/*
 * serve.mjs — local static server that mimics Vercel's cleanUrls + 404 fallback,
 * so you can verify the cloned site before deploying.
 *   node serve.mjs [siteDir] [port]      (defaults: ./framer-site, 4000)
 *
 * Paths are resolved and boundary-checked against the site root, so a request
 * like /../../etc/passwd can never escape the served folder.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'framer-site');
const PORT = Number(process.argv[3] || process.env.PORT || 4000);
const MIME = {
  '.html': 'text/html;charset=utf-8', '.css': 'text/css', '.js': 'application/javascript',
  '.mjs': 'application/javascript', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const send = (res, file, code = 200) => {
  res.writeHead(code, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
};

// Resolve a URL path under ROOT, refusing anything that escapes it.
// Returns an absolute path inside ROOT, or null if it would traverse out.
function safePath(urlPath) {
  const rel = path.posix.normalize('/' + urlPath).replace(/^\/+/, ''); // collapse .., strip leading /
  const abs = path.resolve(ROOT, rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) return null; // outside the root
  return abs;
}
const isFile = (p) => p && fs.existsSync(p) && fs.statSync(p).isFile();

http
  .createServer((req, res) => {
    let url;
    try {
      url = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      res.writeHead(400);
      return res.end('Bad request');
    }

    if (url === '/') return send(res, path.join(ROOT, 'index.html'));

    const fp = safePath(url);
    if (isFile(fp)) return send(res, fp);

    const asHtml = safePath(url.replace(/\/$/, '') + '.html'); // cleanUrls
    if (isFile(asHtml)) return send(res, asHtml);

    const nf = path.join(ROOT, '404.html');
    if (isFile(nf)) return send(res, nf, 404);
    res.writeHead(404);
    res.end('Not found');
  })
  .listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));

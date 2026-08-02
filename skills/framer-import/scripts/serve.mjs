#!/usr/bin/env node
/*
 * serve.mjs — local static server that mimics Vercel's cleanUrls + 404 fallback,
 * so you can verify the cloned site before deploying.
 *   node serve.mjs [siteDir] [port]      (defaults: ./framer-site, 4000)
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

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    const fp = path.join(ROOT, url);
    if (url !== '/' && fs.existsSync(fp) && fs.statSync(fp).isFile()) return send(res, fp);
    if (url === '/') return send(res, path.join(ROOT, 'index.html'));
    const asHtml = path.join(ROOT, url.replace(/\/$/, '') + '.html'); // cleanUrls
    if (fs.existsSync(asHtml)) return send(res, asHtml);
    const nf = path.join(ROOT, '404.html');
    if (fs.existsSync(nf)) return send(res, nf, 404);
    res.writeHead(404);
    res.end('Not found');
  })
  .listen(PORT, () => console.log(`serving ${ROOT} on http://localhost:${PORT}`));

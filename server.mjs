// SPDX-License-Identifier: Apache-2.0
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));
const assets = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/styles.css', ['styles.css', 'text/css; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/lib/analysis.mjs', ['lib/analysis.mjs', 'text/javascript; charset=utf-8']],
  ['/data/demo.mjs', ['data/demo.mjs', 'text/javascript; charset=utf-8']],
  ['/data/questions.mjs', ['data/questions.mjs', 'text/javascript; charset=utf-8']]
]);
const securityHeaders = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Cache-Control': 'no-store'
};
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
const server = createServer(async (req, res) => {
  const path = req.url?.split('?')[0] || '';
  const asset = assets.get(path);
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { ...securityHeaders, Allow: 'GET, HEAD' }); res.end(); return;
  }
  if (!asset) { res.writeHead(404, securityHeaders); res.end('Not found'); return; }
  try {
    const content = await readFile(join(root, asset[0]));
    res.writeHead(200, { ...securityHeaders, 'Content-Type': asset[1], 'Content-Length': content.length });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch {
    res.writeHead(500, securityHeaders); res.end('Internal error');
  }
});
server.listen(port, host, () => console.log(`School AI Discovery running at http://${host}:${port}`));

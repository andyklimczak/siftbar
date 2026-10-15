import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
const port = Number(process.env.PORT ?? 4173);
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.md': 'text/plain', '.txt': 'text/plain' };
createServer(async (request, response) => {
  try {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    // Also serve under the Pages project prefix to exercise relative URL handling.
    if (pathname === '/siftbar') { response.writeHead(302, { Location: '/siftbar/' }); response.end(); return; }
    if (pathname.startsWith('/siftbar/')) pathname = pathname.slice('/siftbar'.length);
    const fixtures = pathname.startsWith('/fixtures/');
    const root = resolve(fixtures ? 'tests/browser/fixtures' : 'site-dist');
    if (fixtures) pathname = pathname.slice('/fixtures'.length);
    let file = resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}/`)) { response.writeHead(403); response.end('Forbidden'); return; }
    if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
    const body = await readFile(file);
    response.writeHead(200, { 'Content-Type': `${mime[extname(file)] ?? 'text/plain'}; charset=utf-8`, 'Cache-Control': 'no-store' });
    response.end(body);
  } catch { response.writeHead(404); response.end('Not found'); }
}).listen(port, '127.0.0.1', () => console.log(`Demo: http://127.0.0.1:${port}/siftbar/`));

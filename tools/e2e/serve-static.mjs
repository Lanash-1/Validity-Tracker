// Tiny static server with expo-router static fallback (route.html or index.html).
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
const root = process.argv[2]; const port = Number(process.argv[3] || 8080);
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.map': 'application/json' };
createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = normalize(join(root, p));
  if (!existsSync(file) || statSync(file).isDirectory()) {
    const html = join(root, p.replace(/\/$/, '') + '.html');
    const dyn = p.split('/').length === 3 && p.startsWith('/items/') ? join(root, 'items/[id].html') : p.startsWith('/items/') ? join(root, 'items/[id]/edit.html') : p.startsWith('/spaces/') ? join(root, 'spaces/[id].html') : p.startsWith('/join/') ? join(root, 'join/[code].html') : null;
    file = existsSync(html) ? html : dyn && existsSync(dyn) ? dyn : join(root, 'index.html');
  }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(port, () => console.log('static on', port));

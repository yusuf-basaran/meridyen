import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.PREVIEW_DIR || 'dist');
const port = Number(process.env.PORT || 4173);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'application/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.xml':'application/xml; charset=utf-8', '.txt':'text/plain; charset=utf-8' };
http.createServer(async (req,res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  if (pathname === '/api/rates') { res.writeHead(200, { 'Content-Type':'application/json' }).end(JSON.stringify({ usd:null, eur:null, btc:null })); return; }
  let file = resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
  try {
    if ((await stat(file)).isDirectory()) {
      if (!pathname.endsWith('/')) { res.writeHead(301, { Location: pathname + '/' }).end(); return; }
      file = resolve(file,'index.html');
    }
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type':types[extname(file)] || 'application/octet-stream', 'X-Content-Type-Options':'nosniff' });
    res.end(body);
  } catch {
    try { res.writeHead(404, { 'Content-Type':'text/html; charset=utf-8' }).end(await readFile(resolve(root,'404.html'))); }
    catch { res.writeHead(404).end('Önce npm run build:demo komutunu çalıştırın.'); }
  }
}).listen(port, '0.0.0.0', () => console.log(`Önizleme: http://localhost:${port}`));

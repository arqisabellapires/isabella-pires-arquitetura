#!/usr/bin/env node
/**
 * Fotografa as páginas do site construído, para comparar com o Figma.
 *
 *   node tools/tira-foto.mjs                       # todas, desktop
 *   node tools/tira-foto.mjs / /servicos           # só estas
 *   node tools/tira-foto.mjs --bp mobile
 *
 * Serve `dist/` num servidor local e salva PNG em _figma/fotos/. É o
 * "olhar a tela" — a etapa que, neste projeto, já pegou dois defeitos que
 * nenhuma verificação automática pegou (título marrom sobre preto e menu
 * branco sobre bege).
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';

const BP = { desktop: [1920, 1080], tablet: [1000, 900], mobile: [390, 844] };
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const bp = arg('bp', 'desktop');
const rotas = process.argv.slice(2).filter((a) => a.startsWith('/'));
const ALVOS = rotas.length ? rotas : ['/', '/servicos', '/projetos', '/sobre-nos', '/contato', '/artigos'];

const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff2': 'font/woff2', '.avif': 'image/avif' };
const RAIZ = existsSync('dist/client') ? 'dist/client' : 'dist';

const servidor = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = join(RAIZ, p);
  if (!extname(f)) f = join(RAIZ, p, 'index.html');
  try {
    res.writeHead(200, { 'content-type': TIPOS[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  } catch { res.writeHead(404).end('nao encontrado'); }
});
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;

mkdirSync('_figma/fotos', { recursive: true });
const [largura, altura] = BP[bp];
const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: largura, height: altura } });

for (const rota of ALVOS) {
  const nome = (rota === '/' ? 'home' : rota.replace(/^\//, '').replace(/\//g, '-')) + `.${bp}.png`;
  const resp = await pagina.goto(`http://localhost:${porta}${rota}`, { waitUntil: 'networkidle' });
  await pagina.evaluate(() => document.fonts.ready);
  await pagina.screenshot({ path: `_figma/fotos/${nome}`, fullPage: true });
  console.log(`  ${resp.status()}  ${rota} → _figma/fotos/${nome}`);
}

await navegador.close();
servidor.close();

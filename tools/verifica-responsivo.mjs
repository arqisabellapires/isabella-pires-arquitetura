#!/usr/bin/env node
/**
 * Portão do responsivo: nada pode vazar horizontalmente.
 *
 *   node tools/verifica-responsivo.mjs
 *
 * O Figma tem só 1920px de largura — todo o comportamento em tablet e
 * celular é decisão nossa, e é onde o erro passa despercebido: uma largura
 * fixa esquecida (um card de 385px, uma foto de 697px) empurra a página
 * para o lado e cria barra de rolagem horizontal, que no celular é o
 * defeito mais visível que existe.
 *
 * Mede nos três breakpoints do projeto e aponta o elemento culpado, não só
 * a página.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';

const ROTAS = ['/', '/servicos', '/projetos', '/sobre-nos', '/contato', '/artigos', '/projetos/casa-ip', '/artigos/tendencias-de-decoracao-para-2025'];
const LARGURAS = { desktop: 1440, tablet: 1000, celular: 390 };
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.woff2': 'font/woff2' };

const servidor = createServer((req, res) => {
  let alvo = join('dist/client', decodeURIComponent(req.url.split('?')[0]));
  if (!extname(alvo)) alvo = join(alvo, 'index.html');
  try {
    res.writeHead(200, { 'content-type': TIPOS[extname(alvo)] ?? 'application/octet-stream' });
    res.end(readFileSync(alvo));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;

const nav = await chromium.launch();
let falhas = 0;

for (const [nome, largura] of Object.entries(LARGURAS)) {
  const pg = await nav.newPage({ viewport: { width: largura, height: 900 } });
  const ruins = [];

  for (const rota of ROTAS) {
    await pg.goto(`http://localhost:${porta}${rota}`, { waitUntil: 'networkidle' });
    const r = await pg.evaluate((vw) => {
      const doc = document.documentElement;
      const vaza = doc.scrollWidth > vw + 1;
      if (!vaza) return null;
      /* Acha quem passa da borda — o culpado, não só o sintoma. */
      const culpados = [...document.querySelectorAll('body *')]
        .filter((e) => e.getBoundingClientRect().right > vw + 1)
        .slice(0, 3)
        .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`);
      return { largura: doc.scrollWidth, culpados };
    }, largura);
    if (r) { ruins.push(`${rota} (${r.largura}px: ${r.culpados.join(', ')})`); falhas++; }
  }

  console.log(ruins.length ? `  ✗ ${nome} ${largura}px` : `  ✓ ${nome} ${largura}px — sem vazamento`);
  for (const x of ruins) console.log(`      ${x}`);
  await pg.close();
}

await nav.close();
servidor.close();

if (falhas) { console.error(`\n✗ ${falhas} páginas vazam para o lado`); process.exit(1); }
console.log('\n✓ nenhuma página vaza horizontalmente');

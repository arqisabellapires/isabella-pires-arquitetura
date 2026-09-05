#!/usr/bin/env node
/**
 * Portão da aparição ao rolar: nada pode ficar invisível.
 *
 *   node tools/verifica-revela.mjs
 *
 * A animação `reveal-entrada` começa com opacity 0. Se a faixa de scroll
 * estiver errada, o elemento nunca completa e o bloco simplesmente não
 * aparece — defeito pior que não ter animação, e que não dá erro nenhum.
 * Aconteceu de verdade: com `animation-range: entry`, o último bloco de
 * /servicos e de /sobre-nos ficava invisível para sempre, porque quem já
 * está na tela no carregamento nunca "entra". `cover` corrigiu.
 *
 * Mede DUAS coisas, porque a primeira versão deste portão media só a
 * segunda e passava batido pelo defeito que existia para pegar:
 *
 * 1. **Ao carregar, sem rolar nada.** É aqui que mora o defeito: quem já
 *    está na tela no primeiro quadro nunca "entra" na viewport, então com
 *    `animation-range: entry` fica congelado em opacity 0 para sempre.
 * 2. **Depois de rolar a página inteira.** Rede para faixas mal calibradas
 *    no meio do documento.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';

const ROTAS = ['/', '/servicos', '/projetos', '/sobre-nos', '/contato', '/artigos', '/projetos/casa-ip'];
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
const pg = await nav.newPage({ viewport: { width: 1440, height: 900 } });
let falhas = 0;

/*
  "Visível" aqui significa BEM dentro da tela, não apenas a borda assomando.
  Um card cujo topo está a 749px de uma viewport de 900 está no comecinho da
  sua faixa de animação, e 0,58 de opacidade ali é o comportamento certo —
  medir isso como defeito fazia o portão reprovar o CSS correto.

  O que importa é: um elemento cuja metade já passou da borda inferior tem
  de estar praticamente opaco.
*/
const transparentesVisiveis = () =>
  pg.evaluate(() =>
    [...document.querySelectorAll('[data-revela], [data-revela-filhos] > *')]
      .filter((e) => {
        const cx = e.getBoundingClientRect();
        const meio = cx.top + cx.height / 2;
        const bemDentro = meio < innerHeight * 0.85 && cx.bottom > 0;
        return bemDentro && +getComputedStyle(e).opacity < 0.9;
      })
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || '').toString().split(' ')[0]}`),
  );

for (const rota of ROTAS) {
  await pg.goto(`http://localhost:${porta}${rota}`, { waitUntil: 'networkidle' });

  /* (1) Sem rolar: o que já está na tela precisa estar visível. */
  await pg.evaluate(() => new Promise((r) => setTimeout(r, 1200)));
  const noCarregamento = await transparentesVisiveis();
  if (noCarregamento.length) {
    falhas += noCarregamento.length;
    console.log(`  ✗ ${rota}: invisível SEM rolar — ${noCarregamento.join(', ')}`);
  }

  await pg.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 25));
    }
    window.scrollTo(0, document.body.scrollHeight);
    /* Espera as animações assentarem: a mais longa mede 0.8s. */
    await new Promise((r) => setTimeout(r, 1200));
  });

  /* (2) Depois de rolar tudo. */
  const sumidos = await transparentesVisiveis();
  const total = await pg.$$eval('[data-revela], [data-revela-filhos] > *', (e) => e.length);
  if (sumidos.length) { falhas += sumidos.length; console.log(`  ✗ ${rota}: invisível ao rolar — ${sumidos.join(', ')}`); }
  else if (!noCarregamento.length) console.log(`  ✓ ${rota} — ${total} elementos aparecem`);
}

await nav.close();
servidor.close();

if (falhas) { console.error(`\n✗ ${falhas} elementos ficam invisíveis`); process.exit(1); }
console.log('\n✓ nada fica invisível depois de rolar');

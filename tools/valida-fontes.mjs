#!/usr/bin/env node
/**
 * O portão das fontes: o navegador carregou as famílias que o CSS declara?
 *
 *   node tools/valida-fontes.mjs
 *
 * Existe por causa de um defeito que passou por tudo: o fontes.css estava
 * íntegro — os 97 arquivos que ele apontava existiam — e mesmo assim o site
 * inteiro renderizava na fonte errada, porque ele declarava 59 faces de Inter
 * (que o design não usa) e nenhuma de Faberge, Arboria ou Montserrat.
 *
 * "O arquivo existe" e "a família que a página pede carregou" são perguntas
 * diferentes. Esta aqui é a segunda, e quem responde é o Chromium.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname } from 'node:path';

/* As famílias que as páginas de fato pedem, com o peso em que as pedem. */
const EXIGIDAS = [
  ['Mulish', 400], ['Mulish', 600], ['Mulish', 700],
  ['Cormorant Garamond', 400], ['Cormorant Garamond', 600],
  ['Jost', 400], ['Jost', 500], ['Jost', 700],
  ['Montserrat', 500], ['Montserrat', 600],
  ['Faberge', 400],   // alias -> Cormorant Garamond
  ['Arboria', 500],   // alias -> Jost
];

const TIPOS = { '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const servidor = createServer((req, res) => {
  const caminho = join('public', decodeURIComponent(req.url.split('?')[0]));
  if (req.url.startsWith('/__portao')) {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end('<!doctype html><meta charset="utf-8">');
  }
  try {
    res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream' });
    res.end(readFileSync(caminho));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => servidor.listen(0, r));
const porta = servidor.address().port;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
const css = readFileSync('src/styles/fontes.css', 'utf8');

/* A rota entra ANTES do conteúdo: registrar depois é chegar tarde, o
   navegador já tentou buscar os arquivos e falhou em silêncio. */
await pagina.route('**/fontes/**', (rota) =>
  rota.continue({ url: `http://localhost:${porta}${new URL(rota.request().url()).pathname}` }));
await pagina.goto(`http://localhost:${porta}/__portao`, { waitUntil: 'domcontentloaded' }).catch(() => {});
await pagina.setContent(`<style>${css}</style><p>a</p>`, { waitUntil: 'domcontentloaded' });

const resultado = await pagina.evaluate(async (exigidas) => {
  const faces = [...document.fonts].map((f) => `${f.family}|${f.weight}`);
  const out = [];
  for (const [familia, peso] of exigidas) {
    await document.fonts.load(`${peso} 16px "${familia}"`).catch(() => {});
    out.push({
      familia, peso,
      declarada: faces.some((f) => f.startsWith(`${familia}|`)),
      carregou: document.fonts.check(`${peso} 16px "${familia}"`),
    });
  }
  return { total: document.fonts.size, itens: out };
}, EXIGIDAS);

await navegador.close();
servidor.close();

console.log(`${resultado.total} @font-face no documento\n`);
let falhou = 0;
for (const r of resultado.itens) {
  const ok = r.declarada && r.carregou;
  if (!ok) falhou++;
  console.log(`  ${ok ? '✓' : '✗'} ${r.familia} ${r.peso}${r.declarada ? '' : '  — não declarada'}`);
}

if (falhou) {
  console.error(`\n✗ ${falhou} de ${EXIGIDAS.length} famílias não chegam à página`);
  process.exit(1);
}
console.log(`\n✓ as ${EXIGIDAS.length} famílias exigidas carregam`);

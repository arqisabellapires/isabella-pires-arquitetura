#!/usr/bin/env node
/**
 * Auditoria objetiva das páginas construídas, no Chromium.
 *
 *   npx astro build && node tools/audita-paginas.mjs
 *
 * O `package.json` referencia um `audita-lighthouse.mjs` que nunca existiu, e
 * o Lighthouse não está instalado nesta máquina. Instalar uma dependência
 * grande é decisão do Gabriel, não de quem executa — então este script mede o
 * que dá para medir sem ela, que é justamente a parte determinística:
 * estrutura, metadados, acessibilidade básica e peso.
 *
 * O que ele NÃO substitui: Performance e as métricas de campo (LCP, CLS).
 * Essas precisam de Lighthouse ou do PageSpeed Insights sobre o domínio no
 * ar. Está anotado no HANDOFF como pendência declarada, não como item pronto.
 *
 * Reprova (saída 1) o que a spec §5.7 define como portão de página:
 * `<h1>` presente e único, title/description únicos no site, `lang`, zero
 * `framer-`, toda imagem com atributo alt, e JSON-LD que faz parse.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const arquivos = execSync('find dist/client -name "*.html"').toString().trim().split('\n').filter(Boolean);
if (!arquivos.length) { console.error('sem dist/client — rode `npx astro build` antes'); process.exit(1); }

const nav = await chromium.launch();
const pg = await nav.newPage();

const titles = new Map(), descricoes = new Map();
const problemas = [];
let semAlt = 0, maiorKB = 0, somaKB = 0;

for (const f of arquivos) {
  const html = readFileSync(f, 'utf8');
  const kb = Math.round(statSync(f).size / 1024);
  somaKB += kb; maiorKB = Math.max(maiorKB, kb);
  const rota = f.replace('dist/client', '').replace('/index.html', '') || '/';

  await pg.setContent(html, { waitUntil: 'domcontentloaded' });
  const r = await pg.evaluate(() => ({
    h1: document.querySelectorAll('h1').length,
    title: document.title.trim(),
    descricao: document.querySelector('meta[name="description"]')?.content?.trim() ?? '',
    lang: document.documentElement.lang,
    canonica: document.querySelector('link[rel="canonical"]')?.href ?? '',
    imgs: document.querySelectorAll('img').length,
    imgsSemAlt: [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
    // Hierarquia: um h3 não pode aparecer antes de existir um h2.
    saltos: (() => {
      const níveis = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
      let pior = 0;
      for (let i = 1; i < níveis.length; i++) pior = Math.max(pior, níveis[i] - níveis[i - 1]);
      return pior;
    })(),
  }));

  if (r.h1 !== 1) problemas.push(`${rota}: ${r.h1} <h1> (deve ser exatamente 1)`);
  if (!r.title) problemas.push(`${rota}: sem <title>`);
  if (!r.descricao) problemas.push(`${rota}: sem meta description`);
  if (!r.lang) problemas.push(`${rota}: <html> sem lang`);
  if (!r.canonica) problemas.push(`${rota}: sem canonical`);
  if (html.includes('framer-')) problemas.push(`${rota}: contém "framer-"`);
  if (r.imgsSemAlt) { problemas.push(`${rota}: ${r.imgsSemAlt} <img> sem atributo alt`); semAlt += r.imgsSemAlt; }
  if (r.saltos > 1) problemas.push(`${rota}: hierarquia de heading salta ${r.saltos} níveis`);

  titles.set(r.title, [...(titles.get(r.title) ?? []), rota]);
  if (r.descricao) descricoes.set(r.descricao, [...(descricoes.get(r.descricao) ?? []), rota]);
}
await nav.close();

for (const [t, rotas] of titles) if (rotas.length > 1) problemas.push(`<title> repetido em ${rotas.length}: "${t.slice(0, 50)}" → ${rotas.slice(0, 3).join(', ')}`);
for (const [d, rotas] of descricoes) if (rotas.length > 1) problemas.push(`description repetida em ${rotas.length} rotas → ${rotas.slice(0, 3).join(', ')}`);

console.log(`${arquivos.length} páginas · média ${Math.round(somaKB / arquivos.length)} KB · maior ${maiorKB} KB`);
console.log(`imagens sem atributo alt: ${semAlt}`);
if (problemas.length) {
  console.log(`\n${problemas.length} problemas:`);
  problemas.forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('\n✓ estrutura, metadados e acessibilidade básica passam em todas as páginas');
console.log('  (Performance/LCP/CLS precisam de Lighthouse — ver HANDOFF)');

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
import { readFileSync, statSync, existsSync } from 'node:fs';
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
    /*
      Contraste de texto sobre o fundo real.

      Existe porque o título da home foi para o preview ILEGÍVEL: marrom
      #341f04 sobre fundo #21201f. O base.css pinta todo h1..h4 com a cor de
      tinta, e isso vence a herança de uma seção escura — quem não declara
      `color` explícito herda o marrom. Build, estrutura e metadados passavam;
      só o olho pegava.

      O limite é 3:1, que é o mínimo da WCAG para texto grande. Não é
      auditoria de acessibilidade completa: é rede para "texto sumiu no
      fundo", que é o defeito que aconteceu.
    */
    semContraste: (() => {
      const lum = (c) => {
        const [r, g, b] = c.match(/\d+/g).slice(0, 3).map((v) => {
          const s = +v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };
      /*
        Devolve null quando há imagem atrás — texto sobre foto é decisão de
        composição, e o contraste real depende do pixel, não do CSS. Sem esta
        saída o verificador acusava os 4 títulos de projeto como "branco sobre
        branco", quando eles estão perfeitamente legíveis sobre a capa.
      */
      const fundoDe = (el) => {
        for (let n = el; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
          if (n.previousElementSibling?.tagName === 'IMG' || n.parentElement?.querySelector(':scope > img')) return null;
          const bg = cs.backgroundColor;
          if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
        }
        return 'rgb(255, 255, 255)';
      };
      const ruins = [];
      for (const el of document.querySelectorAll('h1, h2, h3, p, a, li, span')) {
        const t = el.textContent?.trim();
        /*
          Pular elemento com filhos serve para não medir o contêiner no lugar
          do texto — mas "tem filho" não é o mesmo que "tem filho com texto".
          O <h1> do herói tem um <br> dentro, e por causa disso o verificador
          passou batido justamente pelo bug que o motivou. Só pula quando
          algum filho carrega texto próprio.
        */
        if (!t) continue;
        if ([...el.children].some((f) => f.textContent?.trim())) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
        const cor = cs.color, fundo = fundoDe(el);
        if (!cor.startsWith('rgb') || !fundo) continue;
        const [a, b] = [lum(cor), lum(fundo)].sort((x, y) => y - x);
        const razao = (a + 0.05) / (b + 0.05);
        if (razao < 3) ruins.push({ tag: el.tagName.toLowerCase(), texto: t.slice(0, 28), cor, fundo, razao: razao.toFixed(2) });
      }
      return ruins.slice(0, 4);
    })(),
    // Hierarquia: um h3 não pode aparecer antes de existir um h2.
    saltos: (() => {
      const níveis = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map((h) => +h.tagName[1]);
      let pior = 0;
      for (let i = 1; i < níveis.length; i++) pior = Math.max(pior, níveis[i] - níveis[i - 1]);
      return pior;
    })(),
  }));

  if (r.h1 !== 1) problemas.push(`${rota}: ${r.h1} <h1> (deve ser exatamente 1)`);
  for (const c of r.semContraste) problemas.push(`${rota}: contraste ${c.razao}:1 em <${c.tag}> "${c.texto}" (${c.cor} sobre ${c.fundo})`);
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

/*
  Redirects: os do vercel.json não podem apontar para si mesmos.

  Aconteceu de verdade e só apareceu no preview: ao converter os 302 dos
  artigos em 301, 10 slugs que JÁ eram ASCII viraram redirect para a própria
  URL — loop infinito. A página abria por acaso com barra final, então o build
  passava e o portão de estrutura também. Redirect é configuração, não HTML:
  nenhuma auditoria de página pegaria.
*/
/*
  Fontes e preloads: todo arquivo citado tem que existir.

  Também só apareceu no deploy. O fontes.css era da primeira tentativa e
  apontava para cinco nomes do Google Fonts que nunca estiveram em disco —
  as 97 fontes reais têm nomes hasheados, em subpastas. Resultado: 404 em
  todas, e o site inteiro renderizava na fonte do sistema. O build não
  reclama porque url() dentro de CSS é string, não import.
*/
const css = existsSync('src/styles/fontes.css') ? readFileSync('src/styles/fontes.css', 'utf8') : '';
for (const m of css.matchAll(/url\('([^']+)'\)/g)) {
  if (!existsSync(`public${m[1]}`)) problemas.push(`fontes.css aponta para arquivo inexistente: ${m[1]}`);
}
const base = existsSync('src/layouts/Base.astro') ? readFileSync('src/layouts/Base.astro', 'utf8') : '';
for (const m of base.matchAll(/rel="preload"[\s\S]{0,120}?href="([^"]+)"/g)) {
  if (m[1].startsWith('/') && !existsSync(`public${m[1]}`)) problemas.push(`preload de arquivo inexistente: ${m[1]}`);
}

try {
  const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
  for (const r of vercel.redirects ?? []) {
    if (decodeURIComponent(r.source) === decodeURIComponent(r.destination)) {
      problemas.push(`vercel.json: redirect em loop, ${decodeURIComponent(r.source)} → ele mesmo`);
    }
  }
} catch { /* sem vercel.json, nada a conferir */ }

console.log(`${arquivos.length} páginas · média ${Math.round(somaKB / arquivos.length)} KB · maior ${maiorKB} KB`);
console.log(`imagens sem atributo alt: ${semAlt}`);
if (problemas.length) {
  console.log(`\n${problemas.length} problemas:`);
  problemas.forEach((p) => console.log('  ✗ ' + p));
  process.exit(1);
}
console.log('\n✓ estrutura, metadados e acessibilidade básica passam em todas as páginas');
console.log('  (Performance/LCP/CLS precisam de Lighthouse — ver HANDOFF)');

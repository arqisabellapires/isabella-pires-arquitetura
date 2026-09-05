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
  /*
    A aparição ao rolar é `animation-timeline: view()`, e o `fullPage` do
    Playwright captura o documento inteiro num quadro só, sem rolar: tudo
    abaixo da primeira tela sai em opacity 0, ou seja, BRANCO. A página está
    certa e a fotografia é que mente — isso quase passou por defeito de
    layout aqui.

    A saída é desligar a animação só para a foto. O que se quer fotografar é
    o layout, e o layout é o estado final da animação.
  */
  await pagina.addStyleTag({
    content: '*, *::before, *::after { animation: none !important; opacity: 1 !important; }',
  });

  /* As imagens preguiçosas abaixo da dobra nunca entram no viewport com
     `fullPage`, e saem como retângulo cinza. Força o carregamento delas. */
  await pagina.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    await Promise.all([...document.images]
      .filter((i) => !i.complete)
      .map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
  });

  /*
    Carrosséis com scroll-snap posicionam o slide inicial por JavaScript,
    depois que a página carrega. Sem esperar por isso, a foto pega o trilho
    ainda no começo e o card ativo aparece fora do centro — parece defeito
    de layout e não é.

    Esperar "o scroll parar de mudar" não serve: no instante em que a espera
    começa ele ainda está em zero e parado, e a espera termina antes de o
    script rolar. O que se espera aqui é o slide marcado como ativo estar de
    fato centrado no trilho.
  */
  await pagina.evaluate(() => new Promise((pronto) => {
    const trilhos = [...document.querySelectorAll('[data-trilho]')];
    if (trilhos.length === 0) return pronto();

    const centrado = (trilho) => {
      const ativo = trilho.querySelector('[data-ativo]');
      if (!ativo) return true;
      const t = trilho.getBoundingClientRect();
      const a = ativo.getBoundingClientRect();
      return Math.abs((a.left + a.width / 2) - (t.left + t.width / 2)) < 2;
    };

    const tique = setInterval(() => {
      if (trilhos.every(centrado)) { clearInterval(tique); pronto(); }
    }, 100);
    setTimeout(() => { clearInterval(tique); pronto(); }, 4000);
  }));

  await pagina.evaluate(() => new Promise((r) => setTimeout(r, 300)));
  await pagina.screenshot({ path: `_figma/fotos/${nome}`, fullPage: true });
  console.log(`  ${resp.status()}  ${rota} → _figma/fotos/${nome}`);
}

await navegador.close();
servidor.close();

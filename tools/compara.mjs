#!/usr/bin/env node
/**
 * Lado a lado: a captura do Framer à esquerda, o site novo à direita.
 * É aqui que a seção é aprovada — o portão de pixel só aponta onde olhar.
 *
 *   node tools/compara.mjs                    # direita = public/ (a ponte)
 *   node tools/compara.mjs --direita astro    # direita = astro dev em :4321
 *   node tools/compara.mjs --porta 8960
 *
 * Abre uma página local com dois <iframe> da mesma largura. O seletor de
 * breakpoint redimensiona os dois juntos, o scroll é sincronizado, e o botão
 * "sobrepor" empilha os dois com 50% de opacidade.
 *
 * Por que sobrepor em vez de pintar de vermelho: o mapa de diferença diz que
 * há divergência, não o que fazer com ela. Sobrepondo, deslocamento aparece
 * como fantasma duplo e diferença de textura não aparece — que é exatamente
 * a distinção que interessa quando a fonte renderiza com hinting diferente.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, extname } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : padrao;
};
const DIREITA = arg('direita', 'public');
const PORTA = Number(arg('porta', 8960));
const ASTRO = arg('astro', 'http://localhost:4321');
const REF = '.compara-ref';

// A captura crua roda o runtime do Framer se deixarem. Serve-se sem script,
// igual ao verifica-fidelidade, senão a esquerda anima e a direita não, e a
// comparação vira discussão sobre timing.
rmSync(REF, { recursive: true, force: true });
for (const { pasta } of PAGINAS) {
  mkdirSync(join(REF, pasta), { recursive: true });
  for (const bp of BREAKPOINTS) {
    const origem = join('_capturas', pasta, `${bp.nome}.html`);
    if (!existsSync(origem)) continue;
    writeFileSync(join(REF, pasta, `${bp.nome}.html`),
      readFileSync(origem, 'utf8')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<script[^>]*\/?>/gi, ''));
  }
}

const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.woff2': 'font/woff2',
  '.ico': 'image/x-icon', '.xml': 'application/xml' };

const PAINEL = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Comparar — Isabella Pires</title>
<style>
  :root { color-scheme: dark; --borda: #2c2c2c; --tinta: #e8e4e0; --fundo: #161514; }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fundo); color: var(--tinta);
         font: 13px/1.4 ui-sans-serif, system-ui, sans-serif; height: 100vh;
         display: grid; grid-template-rows: auto 1fr; }
  header { display: flex; gap: 18px; align-items: center; padding: 10px 14px;
           border-bottom: 1px solid var(--borda); flex-wrap: wrap; }
  h1 { font-size: 13px; font-weight: 600; margin: 0 8px 0 0; letter-spacing: .02em; }
  select, button { background: #222; color: var(--tinta); border: 1px solid var(--borda);
                   border-radius: 6px; padding: 5px 10px; font: inherit; cursor: pointer; }
  button[aria-pressed="true"] { background: var(--tinta); color: #111; }
  .palco { position: relative; overflow: auto; display: flex; gap: 14px; justify-content: center;
           padding: 14px; align-items: flex-start; }
  .lado { display: flex; flex-direction: column; gap: 6px; }
  .rotulo { font-size: 11px; opacity: .65; letter-spacing: .06em; text-transform: uppercase; }
  iframe { border: 1px solid var(--borda); background: #fff; display: block; }
  /* Sobreposto: os dois no mesmo lugar, o de cima translúcido. Deslocamento
     vira fantasma duplo; diferença de textura some. */
  .palco.sobreposto { display: block; }
  .palco.sobreposto .lado { position: absolute; top: 14px; left: 50%; transform: translateX(-50%); }
  .palco.sobreposto .lado:last-child iframe { opacity: .5; }
  .palco.sobreposto .rotulo { display: none; }
  .aviso { padding: 10px 14px; opacity: .7; }
</style></head><body>
<header>
  <h1>comparar</h1>
  <select id="pagina"></select>
  <select id="bp"></select>
  <button id="sobrepor" aria-pressed="false">sobrepor</button>
  <button id="sincronizar" aria-pressed="true">scroll junto</button>
  <span id="estado" class="aviso"></span>
</header>
<div class="palco" id="palco">
  <div class="lado"><span class="rotulo">Framer (captura)</span><iframe id="esq"></iframe></div>
  <div class="lado"><span class="rotulo">novo (__DIREITA__)</span><iframe id="dir"></iframe></div>
</div>
<script>
const PAGINAS = __PAGINAS__, BREAKPOINTS = __BREAKPOINTS__, DIREITA = "__DIREITA__", ASTRO = "__ASTRO__";
const $ = (id) => document.getElementById(id);
PAGINAS.forEach(p => $('pagina').add(new Option(p.pasta, p.pasta)));
BREAKPOINTS.forEach(b => $('bp').add(new Option(b.nome + ' · ' + b.largura + 'px', b.nome)));

function urlDireita(pagina) {
  const p = PAGINAS.find(x => x.pasta === pagina);
  return DIREITA === 'astro' ? ASTRO + p.rota : '/novo' + p.rota;
}
function carrega() {
  const pagina = $('pagina').value, bp = BREAKPOINTS.find(b => b.nome === $('bp').value);
  for (const el of [$('esq'), $('dir')]) { el.style.width = bp.largura + 'px'; el.style.height = (window.innerHeight - 90) + 'px'; }
  $('esq').src = '/ref/' + pagina + '/' + bp.nome + '.html';
  $('dir').src = urlDireita(pagina);
  $('estado').textContent = bp.largura + 'px · ' + pagina;
}
$('pagina').onchange = $('bp').onchange = carrega;
addEventListener('resize', carrega);

$('sobrepor').onclick = (e) => {
  const on = e.target.getAttribute('aria-pressed') !== 'true';
  e.target.setAttribute('aria-pressed', on);
  $('palco').classList.toggle('sobreposto', on);
};

// Scroll sincronizado. Só funciona quando os dois documentos são da mesma
// origem — por isso a direita é servida por este mesmo servidor, e não
// direto da porta do astro. Com --direita astro o navegador bloqueia, e o
// botão fica desligado em vez de fingir que funciona.
let sincronizando = false;
$('sincronizar').onclick = (e) => {
  const on = e.target.getAttribute('aria-pressed') !== 'true';
  e.target.setAttribute('aria-pressed', on);
};
function liga(de, para) {
  try {
    de.contentWindow.addEventListener('scroll', () => {
      if (sincronizando || $('sincronizar').getAttribute('aria-pressed') !== 'true') return;
      sincronizando = true;
      para.contentWindow.scrollTo(0, de.contentWindow.scrollY);
      requestAnimationFrame(() => { sincronizando = false; });
    });
  } catch { $('sincronizar').setAttribute('aria-pressed', 'false'); $('sincronizar').disabled = true;
           $('sincronizar').title = 'origem diferente: com --direita astro o navegador não deixa'; }
}
$('esq').onload = () => liga($('esq'), $('dir'));
$('dir').onload = () => liga($('dir'), $('esq'));
carrega();
</script></body></html>`;

const serveArquivo = (res, caminho) => {
  if (!existsSync(caminho)) { res.writeHead(404); return res.end('404 ' + caminho); }
  res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] ?? 'application/octet-stream' });
  res.end(readFileSync(caminho));
};

createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/' || url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(PAINEL
      .replaceAll('__PAGINAS__', JSON.stringify(PAGINAS))
      .replaceAll('__BREAKPOINTS__', JSON.stringify(BREAKPOINTS))
      .replaceAll('__DIREITA__', DIREITA)
      .replaceAll('__ASTRO__', ASTRO));
  }
  if (url.startsWith('/ref/')) return serveArquivo(res, join(REF, url.slice(5)));
  if (url.startsWith('/novo/')) {
    const resto = url.slice(6) || 'index.html';
    const alvo = join('public', resto.endsWith('/') || !extname(resto) ? join(resto, 'index.html') : resto);
    return serveArquivo(res, alvo);
  }
  // Recurso relativo pedido de dentro de um iframe de public/ (imagem, fonte).
  return serveArquivo(res, join('public', url.slice(1)));
}).listen(PORTA, () => {
  console.log(`comparar em  http://localhost:${PORTA}`);
  console.log(`  esquerda: _capturas/*/<bp>.html sem script`);
  console.log(`  direita:  ${DIREITA === 'astro' ? ASTRO + ' (rode `npm run dev` noutro terminal)' : 'public/'}`);
  console.log('\nctrl-c encerra.');
});

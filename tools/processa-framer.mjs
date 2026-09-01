#!/usr/bin/env node
/**
 * Converte as páginas renderizadas do Framer em páginas estáticas próprias.
 *
 *   node tools/processa-framer.mjs
 *
 * Etapas, nesta ordem:
 *   1. remove o runtime do Framer (<script>) e os pingos de telemetria
 *   2. reescreve URLs de asset para caminhos locais
 *   3. normaliza links internos para os slugs sem acento
 *   4. copia as imagens usadas
 *   5. injeta o nosso JS de interações
 *
 * A fidelidade é verificada por diff de pixel em tools/verifica-fidelidade.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const ORIGEM = '_referencia/renderizado';
const REF = '_referencia';
const SAIDA = 'public';

/** Nome do arquivo clonado → rota final (slug sem acento). */
export const ROTAS = {
  'index.html': '/',
  'sobre-nós.html': '/sobre-nos/',
  'serviços.html': '/servicos/',
  'contato.html': '/contato/',
  'projetos.html': '/projetos/',
  'projetos__casa-ip.html': '/projetos/casa-ip/',
  'projetos__ap-mm.html': '/projetos/ap-mm/',
  'projetos__studio.html': '/projetos/studio/',
  'artigos__blog.html': '/artigos/',
  'artigos__vale-mais-a-pena-reformar-ou-construir.html': '/artigos/vale-mais-a-pena-reformar-ou-construir/',
  'artigos__organize-sua-casa-com-olhar-de-arquiteto.html': '/artigos/organize-sua-casa-com-olhar-de-arquiteto/',
  'artigos__o-que-muda-na-arquitetura-residencial-em-2026.html': '/artigos/o-que-muda-na-arquitetura-residencial-em-2026/',
  'artigos__iluminação-decorativa-x-iluminação-funcional.html': '/artigos/iluminacao-decorativa-x-iluminacao-funcional/',
  'artigos__minimalismo-vs.-maximalismo-qual-estilo-combina-com-você.html':
    '/artigos/minimalismo-vs-maximalismo-qual-estilo-combina-com-voce/',
};

/** Link interno do Framer (com acento) → rota nova. Vira 301 também. */
const LINKS = {
  './': '/',
  './sobre-nós': '/sobre-nos/',
  './serviços': '/servicos/',
  './contato': '/contato/',
  './projetos': '/projetos/',
  './projetos/casa-ip': '/projetos/casa-ip/',
  './projetos/ap-mm': '/projetos/ap-mm/',
  './projetos/studio': '/projetos/studio/',
  './artigos/blog': '/artigos/',
  './artigos/vale-mais-a-pena-reformar-ou-construir': '/artigos/vale-mais-a-pena-reformar-ou-construir/',
  './artigos/organize-sua-casa-com-olhar-de-arquiteto': '/artigos/organize-sua-casa-com-olhar-de-arquiteto/',
  './artigos/o-que-muda-na-arquitetura-residencial-em-2026': '/artigos/o-que-muda-na-arquitetura-residencial-em-2026/',
  './artigos/iluminação-decorativa-x-iluminação-funcional': '/artigos/iluminacao-decorativa-x-iluminacao-funcional/',
  './artigos/minimalismo-vs.-maximalismo-qual-estilo-combina-com-você':
    '/artigos/minimalismo-vs-maximalismo-qual-estilo-combina-com-voce/',
};

const imagensUsadas = new Set();

/** Nome local determinístico e seguro para uma variante de imagem. */
function nomeLocal(base, query) {
  if (!query) return base;
  const ponto = base.lastIndexOf('.');
  const nome = base.slice(0, ponto);
  const ext = base.slice(ponto);
  const variante = query.slice(1).replace(/&amp;/g, '&').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${nome}--${variante}${ext}`;
}

function processa(html) {
  let s = html;

  // 1. runtime do Framer e telemetria
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<script[^>]*\/?>/gi, '');
  s = s.replace(/<link[^>]+href="[^"]*(?:framer\.com|events\.framer\.com)[^"]*"[^>]*>/gi, '');
  s = s.replace(/<link[^>]+rel="(?:modulepreload|preload)"[^>]*framerusercontent\.com\/sites[^>]*>/gi, '');

  // 2. imagens → /img/
  //    O clone guarda cada variante de srcset como arquivo próprio, trocando
  //    o "?" da query por "@". Preservamos a variante no nome local.
  s = s.replace(
    /(?:\.\.\/)?framerusercontent\.com\/images\/([A-Za-z0-9._-]+)([@?][^"'\s)\\]*)?/g,
    (_m, base, query) => {
      // O clone salva a variante como "base@query"; o HTML já referencia assim.
      // No HTML o "&" vem escapado como &amp;; no disco o arquivo usa "&".
      const consulta = query ? query.slice(1).replace(/&amp;/g, '&') : '';
      const arquivoClone = consulta ? `${base}@${consulta}` : base;
      const local = nomeLocal(base, query);
      imagensUsadas.add({ clone: arquivoClone, local, base });
      return `/img/${local}`;
    }
  );

  // 3. fontes, de três origens diferentes, todas para /fontes/
  //    a) Google Fonts   b) assets do próprio Framer   c) Fontshare
  s = s.replace(/(?:\.\.\/)?fonts\.gstatic\.com\/s\//g, '/fontes/gstatic/');
  s = s.replace(/(?:\.\.\/)?framerusercontent\.com\/assets\//g, '/fontes/framer/');
  s = s.replace(/(?:\.\.\/)?framerusercontent\.com\/third-party-assets\//g, '/fontes/terceiros/');

  // 4. links internos → slugs normalizados.
  //    Ordena do mais longo para o mais curto, senão './' engole os outros.
  for (const de of Object.keys(LINKS).sort((a, b) => b.length - a.length)) {
    s = s.split(`href="${de}"`).join(`href="${LINKS[de]}"`);
  }

  // 5. formulários: o HTML do Framer vem sem action, porque quem tratava o
  //    envio era o runtime que removemos no passo 1. Aponta cada form para o
  //    endpoint certo — o de contato tem textarea "Mensagem", o da newsletter
  //    só tem o campo de e-mail. Com o action no HTML, o envio funciona mesmo
  //    sem JavaScript; formularios.js só melhora a experiência.
  s = s.replace(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi, (todo, atributos, interno) => {
    if (/\baction=/i.test(atributos)) return todo;
    const rota = /name="Mensagem"/i.test(interno) ? '/api/contato' : '/api/newsletter';
    return `<form${atributos} method="POST" action="${rota}">${interno}</form>`;
  });

  // 6. nosso JS, no fim do body
  s = s.replace(
    /<\/body>/i,
    '  <script src="/interacoes.js" defer></script>\n' +
      '  <script src="/formularios.js" defer></script>\n</body>',
  );

  return s;
}

// ── execução ──
mkdirSync(join(SAIDA, 'img'), { recursive: true });
let paginas = 0;

for (const arquivo of readdirSync(ORIGEM).filter((f) => f.endsWith('.html'))) {
  const rota = ROTAS[arquivo];
  if (!rota) { console.warn(`⚠ sem rota definida: ${arquivo}`); continue; }

  const html = processa(readFileSync(join(ORIGEM, arquivo), 'utf8'));
  const destino = rota === '/' ? join(SAIDA, 'index.html') : join(SAIDA, rota, 'index.html');
  mkdirSync(join(destino, '..'), { recursive: true });
  writeFileSync(destino, html);
  paginas++;
}

let copiadas = 0;
const faltando = [];
const disponiveis = readdirSync(join(REF, 'framerusercontent.com/images'));
for (const img of imagensUsadas) {
  const exato = join(REF, 'framerusercontent.com/images', img.clone);
  if (existsSync(exato)) {
    copyFileSync(exato, join(SAIDA, 'img', img.local));
    copiadas++;
    continue;
  }
  // Sem a variante exata, usa a maior disponível do mesmo arquivo-base.
  const alternativa = disponiveis
    .filter((f) => f.startsWith(img.base))
    .sort((a, b) => b.length - a.length)[0];
  if (alternativa) {
    copyFileSync(join(REF, 'framerusercontent.com/images', alternativa), join(SAIDA, 'img', img.local));
    copiadas++;
  } else {
    faltando.push(img.clone);
  }
}

// ── fontes: copia as três árvores preservando a estrutura ──
function copiaArvore(de, para) {
  if (!existsSync(de)) return 0;
  let n = 0;
  for (const item of readdirSync(de, { withFileTypes: true })) {
    const origem = join(de, item.name);
    const destino = join(para, item.name);
    if (item.isDirectory()) {
      mkdirSync(destino, { recursive: true });
      n += copiaArvore(origem, destino);
    } else {
      mkdirSync(para, { recursive: true });
      copyFileSync(origem, destino);
      n++;
    }
  }
  return n;
}

const fontes =
  copiaArvore(join(REF, 'fonts.gstatic.com/s'), join(SAIDA, 'fontes/gstatic')) +
  copiaArvore(join(REF, 'framerusercontent.com/assets'), join(SAIDA, 'fontes/framer')) +
  copiaArvore(join(REF, 'framerusercontent.com/third-party-assets'), join(SAIDA, 'fontes/terceiros'));

console.log(`✓ ${paginas} páginas geradas em ${SAIDA}/`);
console.log(`✓ ${fontes} arquivos de fonte copiados`);
console.log(`✓ ${copiadas} imagens copiadas para ${SAIDA}/img/`);
if (faltando.length) {
  console.log(`⚠ ${faltando.length} imagem(ns) referenciadas mas ausentes no clone:`);
  faltando.slice(0, 8).forEach((f) => console.log(`   · ${f}`));
}

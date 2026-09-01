#!/usr/bin/env node
/**
 * Converte as capturas fundidas do Framer em páginas estáticas próprias.
 *
 *   node tools/funde-breakpoints.mjs && node tools/processa-framer.mjs
 *
 * A entrada é _capturas/<pasta>/fundido.html — as três árvores de breakpoint
 * empilhadas. As imagens e fontes ainda saem do clone em _referencia/, que é
 * onde os binários estão em disco.
 *
 * Etapas, nesta ordem:
 *   1. remove o runtime do Framer (<script>) e os pingos de telemetria
 *   2. reescreve URLs de asset para caminhos locais
 *   3. reescreve as fontes, que vêm de três origens diferentes
 *   4. normaliza links internos para os slugs sem acento
 *   5. aponta os formulários para os nossos endpoints
 *   6. injeta o nosso JS de interações
 *
 * A fidelidade é verificada por diff de pixel em tools/verifica-fidelidade.mjs.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, LINKS } from './paginas.mjs';

const ORIGEM = '_capturas';
const REF = '_referencia';
const SAIDA = 'public';

/** Prefixo de origem: absoluto, protocol-relative ou relativo ao clone. */
const ORIGEM_URL = String.raw`(?:https?:)?\/\/|\.\.\/`;

/** Preenchido por processa(): toda variante de imagem que o HTML referencia. */
export const imagensUsadas = new Set();

/** Nome local determinístico e seguro para uma variante de imagem. */
function nomeLocal(base, query) {
  if (!query) return base;
  const ponto = base.lastIndexOf('.');
  const nome = base.slice(0, ponto);
  const ext = base.slice(ponto);
  const variante = query.slice(1).replace(/&amp;/g, '&').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `${nome}--${variante}${ext}`;
}

export function processa(html) {
  let s = html;

  // 1. runtime do Framer e telemetria
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<script[^>]*\/?>/gi, '');
  s = s.replace(/<link[^>]+href="[^"]*(?:framer\.com|events\.framer\.com)[^"]*"[^>]*>/gi, '');
  s = s.replace(/<link[^>]+rel="(?:modulepreload|preload)"[^>]*framerusercontent\.com\/sites[^>]*>/gi, '');

  //    A barra "Edit Content" do editor. A captura foi feita logado no Framer,
  //    e ele injeta a barra no HTML servido: dois <style>, um <div> e um
  //    <iframe> para framer.com — que o site no ar carregava sem ninguém pedir.
  s = s.replace(/<style>\s*#__framer-editorbar[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<div id="__framer-editorbar-container"[\s\S]*?<\/button><\/div>/gi, '');
  s = s.replace(/<iframe id="__framer-editorbar"[\s\S]*?<\/iframe>/gi, '');

  // 2. imagens → /img/
  //    O clone guarda cada variante de srcset como arquivo próprio, trocando
  //    o "?" da query por "@". Preservamos a variante no nome local.
  s = s.replace(
    new RegExp(`(?:${ORIGEM_URL})?framerusercontent\\.com\\/images\\/([A-Za-z0-9._-]+)([@?][^"'\\s)\\\\]*)?`, 'g'),
    (_m, base, query) => {
      // O clone salva a variante como "base@query"; o HTML já referencia assim.
      // No HTML o "&" vem escapado como &amp;; no disco o arquivo usa "&".
      const consulta = query ? query.slice(1).replace(/&amp;/g, '&') : '';
      const arquivoClone = consulta ? `${base}@${consulta}` : base;
      const local = nomeLocal(base, query);
      const url = `https://framerusercontent.com/images/${base}${consulta ? `?${consulta}` : ''}`;
      imagensUsadas.add({ clone: arquivoClone, local, base, url });
      return `/img/${local}`;
    }
  );

  // 3. fontes, de três origens diferentes, todas para /fontes/
  //    a) Google Fonts   b) assets do próprio Framer   c) Fontshare
  const fonte = (de, para) => { s = s.replace(new RegExp(`(?:${ORIGEM_URL})?${de}`, 'g'), para); };
  fonte(String.raw`fonts\.gstatic\.com\/s\/`, '/fontes/gstatic/');
  fonte(String.raw`framerusercontent\.com\/assets\/`, '/fontes/framer/');
  fonte(String.raw`framerusercontent\.com\/third-party-assets\/`, '/fontes/terceiros/');

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
if (import.meta.url !== `file://${process.argv[1]}`) {
  // importado só pelas funções; não gera nada
} else {
mkdirSync(join(SAIDA, 'img'), { recursive: true });
let paginas = 0;
const semCaptura = [];

for (const { pasta, rota } of PAGINAS) {
  const entrada = join(ORIGEM, pasta, 'fundido.html');
  if (!existsSync(entrada)) { semCaptura.push(pasta); continue; }

  const html = processa(readFileSync(entrada, 'utf8'));
  const destino = rota === '/' ? join(SAIDA, 'index.html') : join(SAIDA, rota, 'index.html');
  mkdirSync(join(destino, '..'), { recursive: true });
  writeFileSync(destino, html);
  paginas++;
}

let copiadas = 0;
let aproximadas = 0;
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
    aproximadas++;
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
console.log(`✓ ${copiadas} imagens copiadas para ${SAIDA}/img/ (${aproximadas} por aproximação de variante)`);
if (semCaptura.length) console.log(`⚠ sem fundido.html: ${semCaptura.join(', ')}`);
if (faltando.length) {
  console.log(`⚠ ${faltando.length} imagem(ns) referenciadas mas ausentes no clone:`);
  faltando.slice(0, 8).forEach((f) => console.log(`   · ${f}`));
}
}

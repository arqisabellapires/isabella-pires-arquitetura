#!/usr/bin/env node
/**
 * Funde as capturas de uma página nos três breakpoints do Framer em um
 * único HTML. O <head> é idêntico entre elas, então entra uma vez só; os
 * corpos entram empilhados, cada um ligado por media query.
 *
 * O invólucro usa display:contents para não existir no layout — as regras
 * do Framer continuam valendo como se os filhos fossem diretos do <body>.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export const BREAKPOINTS = [
  { nome: 'desktop', largura: 1440, media: '(min-width: 1200px)' },
  { nome: 'tablet',  largura: 1000, media: '(min-width: 810px) and (max-width: 1199.98px)' },
  { nome: 'mobile',  largura: 390,  media: '(max-width: 809.98px)' },
];

const CSS_CHAVE = `
/* ── troca de breakpoint: só uma árvore fica no layout por vez ── */
[data-bp] { display: none; }
${BREAKPOINTS.map((b) => `@media ${b.media} { [data-bp="${b.nome}"] { display: contents; } }`).join('\n')}
`;

const pegaHead = (h) => h.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? '';
const pegaBody = (h) => h.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? '';
const pegaAtributosBody = (h) => h.match(/<body([^>]*)>/i)?.[1] ?? '';

export function funde(caminhos) {
  const html = Object.fromEntries(
    Object.entries(caminhos).map(([bp, c]) => [bp, readFileSync(c, 'utf8')])
  );
  const base = html[BREAKPOINTS[0].nome];

  const corpos = BREAKPOINTS.map(
    (b) => `<div data-bp="${b.nome}">${pegaBody(html[b.nome])}</div>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>${pegaHead(base)}
<style>${CSS_CHAVE}</style>
</head>
<body${pegaAtributosBody(base)}>
${corpos}
</body>
</html>`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] ?? '_capturas/home';
  const saida = process.argv[3] ?? '_capturas/home/fundido.html';
  const caminhos = Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, `${dir}/${b.nome}.html`]));
  const out = funde(caminhos);
  writeFileSync(saida, out);
  console.log(`✓ ${saida} — ${(out.length / 1024).toFixed(0)} KB`);
}

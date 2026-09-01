#!/usr/bin/env node
/**
 * Funde as capturas de cada página nos três breakpoints do Framer em um
 * único HTML. O <head> é idêntico entre elas (mesmo MD5), então entra uma
 * vez só; os corpos entram empilhados, cada um ligado por media query.
 *
 * O invólucro usa display:contents para não existir no layout — as regras
 * do Framer continuam valendo como se os filhos fossem diretos do <body>.
 *
 *   node tools/funde-breakpoints.mjs               # as 14 páginas
 *   node tools/funde-breakpoints.mjs _capturas/home  # uma só
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

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

/** Funde um diretório de capturas em <dir>/fundido.html. */
export function fundeDiretorio(dir) {
  const caminhos = Object.fromEntries(
    BREAKPOINTS.map((b) => [b.nome, `${dir}/${b.nome}.html`]),
  );
  const ausentes = Object.values(caminhos).filter((c) => !existsSync(c));
  if (ausentes.length) throw new Error(`capturas ausentes: ${ausentes.join(', ')}`);

  const out = funde(caminhos);
  writeFileSync(`${dir}/fundido.html`, out);
  return out.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const alvo = process.argv[2];
  const dirs = alvo ? [alvo] : PAGINAS.map((p) => `_capturas/${p.pasta}`);

  let ok = 0;
  for (const dir of dirs) {
    try {
      const bytes = fundeDiretorio(dir);
      console.log(`✓ ${dir}/fundido.html — ${(bytes / 1024).toFixed(0)} KB`);
      ok++;
    } catch (e) {
      console.log(`✗ ${dir} — ${e.message}`);
    }
  }
  console.log(`\n${ok}/${dirs.length} páginas fundidas`);
}

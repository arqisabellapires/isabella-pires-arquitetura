#!/usr/bin/env node
/**
 * Confere que toda captura em _capturas/ é mesmo do site do Framer.
 *
 *   node tools/audita-capturas.mjs
 *
 * Já aconteceu de duas páginas serem capturadas do nosso próprio site na
 * Vercel. A referência falsa não denuncia nada sozinha: ela compara a
 * migração consigo mesma e "aprova". Os dois sinais são a ausência do
 * runtime do Framer e o DOM idêntico entre os três breakpoints.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

let suspeitas = 0;
for (const { pasta } of PAGINAS) {
  const linhas = [];
  const tamanhos = [];
  for (const bp of BREAKPOINTS) {
    const f = join('_capturas', pasta, `${bp.nome}.html`);
    if (!existsSync(f)) { linhas.push(`${bp.nome}: ausente`); continue; }
    const h = readFileSync(f, 'utf8');
    const runtime = (h.match(/framerusercontent\.com\/sites\//g) ?? []).length;
    const nossas = (h.match(/"\/img\//g) ?? []).length;
    tamanhos.push(h.length);
    if (runtime < 5 || nossas > 0) linhas.push(`${bp.nome}: runtime=${runtime} refs-locais=${nossas}`);
  }
  const iguais = tamanhos.length === 3 && new Set(tamanhos).size === 1;
  if (iguais) linhas.push('os 3 breakpoints são idênticos');

  if (linhas.length) { suspeitas++; console.log(`✗ ${pasta}\n   · ${linhas.join('\n   · ')}`); }
  else console.log(`✓ ${pasta}`);
}

console.log(`\n${PAGINAS.length - suspeitas}/${PAGINAS.length} capturas confirmadas como do Framer`);
if (suspeitas) { console.log('recapture com: node tools/captura-breakpoints.mjs <pasta>'); process.exitCode = 1; }

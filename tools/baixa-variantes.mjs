#!/usr/bin/env node
/**
 * Baixa para o clone as variantes de imagem que só as capturas de celular e
 * tablet referenciam. O clone em _referencia/ foi feito a partir do desktop,
 * então não tem os recortes que o Framer serve nos outros breakpoints.
 *
 *   node tools/baixa-variantes.mjs
 *
 * URGENTE enquanto a assinatura do Framer existir: sem esses arquivos o
 * processador cai no fallback "maior variante disponível", que entrega a
 * imagem certa na resolução errada.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS } from './paginas.mjs';
import { processa, imagensUsadas } from './processa-framer.mjs';

const DESTINO = '_referencia/framerusercontent.com/images';
mkdirSync(DESTINO, { recursive: true });

for (const { pasta } of PAGINAS) {
  const entrada = join('_capturas', pasta, 'fundido.html');
  if (existsSync(entrada)) processa(readFileSync(entrada, 'utf8'));
}

const faltando = [...imagensUsadas].filter((i) => !existsSync(join(DESTINO, i.clone)));
console.log(`${imagensUsadas.size} variantes referenciadas, ${faltando.length} ausentes no clone\n`);

let ok = 0;
const falhas = [];
for (const img of faltando) {
  try {
    const r = await fetch(img.url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    writeFileSync(join(DESTINO, img.clone), Buffer.from(await r.arrayBuffer()));
    ok++;
    if (ok % 25 === 0) console.log(`  ${ok}/${faltando.length}`);
  } catch (e) {
    falhas.push(`${img.clone} — ${e.message}`);
  }
}

console.log(`\n\n${ok}/${faltando.length} variantes baixadas`);
if (falhas.length) {
  console.log(`✗ ${falhas.length} falharam:`);
  falhas.slice(0, 10).forEach((f) => console.log(`   · ${f}`));
}

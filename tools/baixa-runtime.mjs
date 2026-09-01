#!/usr/bin/env node
/**
 * Baixa o runtime JavaScript do Framer, com os source maps.
 *
 *   node tools/baixa-runtime.mjs
 *
 * URGENTE enquanto a assinatura do Framer existir. É daqui que saem as 4
 * interações que morreram na migração — carrossel, acordeão, menu de
 * celular e scroll reveals. Os source maps estão publicados, então o que
 * se recupera é o código original, com nome de variável, não o minificado.
 *
 * Parte dos módulos citados nas capturas e segue os imports de dentro
 * deles: o Framer carrega chunk sob demanda, e o que está no HTML é só a
 * primeira camada.
 *
 * Saída: _capturas/_runtime/ (versionado — é material insubstituível)
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

const DESTINO = '_capturas/_runtime';
mkdirSync(DESTINO, { recursive: true });

// ── sementes: tudo que as capturas citam ──
const fila = new Set();
for (const { pasta } of PAGINAS) {
  for (const bp of BREAKPOINTS) {
    const f = join('_capturas', pasta, `${bp.nome}.html`);
    if (!existsSync(f)) continue;
    for (const u of readFileSync(f, 'utf8').match(/https:\/\/framerusercontent\.com\/sites\/[A-Za-z0-9/_.-]+\.mjs/g) ?? [])
      fila.add(u);
  }
}
console.log(`${fila.size} módulos citados nas capturas`);

const visitados = new Set();
const falhas = [];
let mapas = 0;

async function baixa(url) {
  if (visitados.has(url)) return;
  visitados.add(url);

  const nome = url.split('/').pop();
  let corpo;
  try {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    corpo = await r.text();
  } catch (e) {
    falhas.push(`${nome} — ${e.message}`);
    return;
  }
  writeFileSync(join(DESTINO, nome), corpo);

  // o source map, que é onde mora o código legível
  try {
    const r = await fetch(`${url}.map`);
    if (r.ok) { writeFileSync(join(DESTINO, `${nome}.map`), await r.text()); mapas++; }
  } catch { /* sem mapa, segue */ }

  // segue os imports: from "./x.mjs", import("./x.mjs"), from "/sites/.../x.mjs"
  const base = url.slice(0, url.lastIndexOf('/'));
  for (const m of corpo.matchAll(/["'`](\.{0,2}\/[A-Za-z0-9/_.-]+\.mjs)["'`]/g)) {
    const esp = m[1];
    const absoluto = esp.startsWith('/')
      ? `https://framerusercontent.com${esp}`
      : `${base}/${esp.replace(/^\.\//, '')}`;
    if (!visitados.has(absoluto)) await baixa(absoluto);
  }
}

for (const u of fila) await baixa(u);

const arquivos = readdirSync(DESTINO);
const js = arquivos.filter((f) => f.endsWith('.mjs')).length;
const bytes = arquivos.reduce((n, f) => n + readFileSync(join(DESTINO, f)).length, 0);
console.log(`\n✓ ${js} módulos e ${mapas} source maps em ${DESTINO}/`);
console.log(`✓ ${(bytes / 1048576).toFixed(1)} MB`);
if (falhas.length) {
  console.log(`⚠ ${falhas.length} falha(s):`);
  falhas.slice(0, 8).forEach((f) => console.log(`   · ${f}`));
}

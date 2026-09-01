#!/usr/bin/env node
/**
 * Converte as imagens copiadas do Framer para WebP e reescreve as
 * referências no HTML gerado.
 *
 *   node tools/otimiza-imagens.mjs [--qualidade 82]
 *
 * Não redimensiona: as larguras declaradas no srcset precisam continuar
 * verdadeiras, senão o navegador escolhe a variante errada. O ganho vem
 * só da codificação, e já é grande.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import sharp from 'sharp';

const DIR = 'public/img';
const i = process.argv.indexOf('--qualidade');
const QUALIDADE = i > -1 ? Number(process.argv[i + 1]) : 82;

const arquivos = readdirSync(DIR).filter((f) => /\.(jpe?g|png)$/i.test(f));
let antes = 0, depois = 0, convertidas = 0;
const renomeadas = new Map();

for (const arq of arquivos) {
  const origem = join(DIR, arq);
  const destino = join(DIR, `${basename(arq, extname(arq))}.webp`);
  const tamAntes = statSync(origem).size;

  try {
    await sharp(origem, { limitInputPixels: false })
      .webp({ quality: QUALIDADE, effort: 5 })
      .toFile(destino);
  } catch (e) {
    console.warn(`⚠ falhou: ${arq} — ${e.message.slice(0, 60)}`);
    continue;
  }

  const tamDepois = statSync(destino).size;
  // Se o WebP ficou maior (acontece com PNG de poucas cores), mantém o original.
  if (tamDepois >= tamAntes) {
    unlinkSync(destino);
    continue;
  }

  antes += tamAntes;
  depois += tamDepois;
  convertidas++;
  renomeadas.set(arq, basename(destino));
  unlinkSync(origem);
}

// Reescreve as referências no HTML já gerado
let paginasTocadas = 0;
function percorre(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const caminho = join(dir, item.name);
    if (item.isDirectory()) { percorre(caminho); continue; }
    if (!item.name.endsWith('.html')) continue;
    let html = readFileSync(caminho, 'utf8');
    const original = html;
    for (const [de, para] of renomeadas) html = html.split(`/img/${de}`).join(`/img/${para}`);
    if (html !== original) { writeFileSync(caminho, html); paginasTocadas++; }
  }
}
percorre('public');

const mb = (n) => (n / 1048576).toFixed(1);
console.log(`✓ ${convertidas} imagens convertidas para WebP`);
console.log(`✓ ${mb(antes)} MB → ${mb(depois)} MB  (${(100 - (depois / antes) * 100).toFixed(0)}% menor)`);
console.log(`✓ ${paginasTocadas} páginas com referências atualizadas`);

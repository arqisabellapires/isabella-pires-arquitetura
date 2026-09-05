#!/usr/bin/env node
/**
 * As imagens que o Figma exporta vêm em PNG sem compressão — 142 MB para 43
 * arquivos. Isso não vai para a web.
 *
 *   node tools/otimiza-figma.mjs
 *
 * Converte para WebP com qualidade 82 e teto de 1920px de largura (o canvas
 * do design), preservando o nome. O PNG original é apagado depois de a
 * conversão dar certo — o que interessa versionar é o WebP.
 */
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'public/imagens/figma';
const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.png'));
let antes = 0, depois = 0;

for (const nome of arquivos) {
  const origem = join(DIR, nome);
  const destino = origem.replace(/\.png$/, '.webp');
  antes += statSync(origem).size;
  await sharp(origem)
    .resize({ width: 1920, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile(destino);
  depois += statSync(destino).size;
  unlinkSync(origem);
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);
console.log(`${arquivos.length} imagens: ${mb(antes)} MB → ${mb(depois)} MB`);

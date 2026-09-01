#!/usr/bin/env node
/**
 * Desempacota os source maps do runtime do Framer em arquivos legíveis.
 *
 *   node tools/extrai-fontes.mjs
 *
 * Os mapas trazem `sourcesContent`: o código original, com nome de
 * variável e comentários, antes da minificação. É o que permite ler como
 * as interações funcionavam em vez de adivinhar pelo bundle.
 *
 * Saída: _fonte-framer/ (fora do git — é código proprietário do Framer,
 * material de estudo, e este repositório é público)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ORIGEM = '_capturas/_runtime';
const SAIDA = '_fonte-framer';

let arquivos = 0, bytes = 0, mapas = 0;
const porPacote = new Map();

for (const m of readdirSync(ORIGEM).filter((f) => f.endsWith('.map'))) {
  let mapa;
  try { mapa = JSON.parse(readFileSync(join(ORIGEM, m), 'utf8')); }
  catch { console.warn(`⚠ mapa ilegível: ${m}`); continue; }
  if (!mapa.sourcesContent) continue;
  mapas++;

  mapa.sources.forEach((origem, i) => {
    const conteudo = mapa.sourcesContent[i];
    if (conteudo == null) return;
    // "../../node_modules/x/y.js" e "webpack://..." viram caminho limpo
    const limpo = origem
      .replace(/^(\.\.\/)+/, '')
      .replace(/^webpack:\/\/[^/]*\//, '')
      .replace(/^\/+/, '')
      .replace(/[?#].*$/, '') || `anonimo-${i}.js`;
    const destino = join(SAIDA, limpo);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
    arquivos++;
    bytes += conteudo.length;
    const pacote = limpo.split('/')[0];
    porPacote.set(pacote, (porPacote.get(pacote) ?? 0) + 1);
  });
}

console.log(`✓ ${arquivos} arquivos de ${mapas} mapas — ${(bytes / 1048576).toFixed(1)} MB em ${SAIDA}/\n`);
console.log('maiores conjuntos:');
[...porPacote].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([p, n]) => console.log(`  ${String(n).padStart(5)}  ${p}`));

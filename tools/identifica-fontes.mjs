#!/usr/bin/env node
/**
 * As 73 woff2 do Framer estão em disco com nome-hash. Este programa abre
 * cada uma, lê a tabela de nomes de dentro do arquivo e diz que fonte é.
 *
 * Existe porque `fontes.css` declara @font-face só para Mulish, enquanto o
 * design usa Faberge, Arboria e Montserrat também — e sem o mapa
 * nome→arquivo não dá para escrever as declarações que faltam.
 *
 *   node tools/identifica-fontes.mjs
 */
import * as fontkit from 'fontkit';
import { readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const PASTAS = ['public/fontes/framer', 'public/fontes/terceiros/fontshare'];
const mapa = [];

for (const pasta of PASTAS) {
  let arquivos;
  try { arquivos = readdirSync(pasta, { recursive: true }); } catch { continue; }
  for (const nome of arquivos) {
    if (!/\.(woff2?|ttf|otf)$/i.test(nome)) continue;
    const caminho = join(pasta, nome);
    try {
      const f = fontkit.openSync(caminho);
      mapa.push({
        arquivo: caminho,
        familia: f.familyName ?? '?',
        subfamilia: f.subfamilyName ?? '',
        postscript: f.postscriptName ?? '',
        peso: f['OS/2']?.usWeightClass ?? null,
        italico: Boolean(f['OS/2']?.fsSelection & 1),
      });
    } catch (e) {
      mapa.push({ arquivo: caminho, erro: String(e.message).slice(0, 80) });
    }
  }
}

const porFamilia = new Map();
for (const f of mapa) {
  if (f.erro) continue;
  if (!porFamilia.has(f.familia)) porFamilia.set(f.familia, []);
  porFamilia.get(f.familia).push(f);
}

console.log(`${mapa.length} arquivos lidos, ${porFamilia.size} famílias\n`);
for (const [familia, arquivos] of [...porFamilia].sort()) {
  console.log(`${familia}  (${arquivos.length})`);
  for (const a of arquivos.sort((x, y) => (x.peso ?? 0) - (y.peso ?? 0))) {
    console.log(`   ${String(a.peso ?? '?').padStart(4)} ${a.italico ? 'ital' : '    '}  ${a.subfamilia.padEnd(18)} ${a.arquivo}`);
  }
}

const erros = mapa.filter((f) => f.erro);
if (erros.length) console.log(`\n${erros.length} não abriram:`, erros.slice(0, 5));

writeFileSync('_capturas/fontes-mapa.json', JSON.stringify(mapa, null, 2));
console.log('\nmapa -> _capturas/fontes-mapa.json');

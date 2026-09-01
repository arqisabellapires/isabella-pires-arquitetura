#!/usr/bin/env node
/**
 * Traz para casa as imagens que aparecem DENTRO do corpo dos artigos.
 *
 *   node tools/baixa-imagens-do-corpo.mjs            # baixa e reescreve
 *   node tools/baixa-imagens-do-corpo.mjs --simular  # só relata
 *
 * O `baixa-capas.mjs` cuida da capa, que é campo do CMS. O corpo é rich text:
 * as imagens estão como <img src="https://framerusercontent.com/..."> no meio
 * do HTML que o Framer exportou. Enquanto continuarem apontando para lá, os
 * artigos dependem de uma CDN que vai embora com a assinatura.
 *
 * Onde cada coisa fica, seguindo o que o resto do projeto já faz:
 *   · original  → _importar/imagens/corpo/   (fora do git, como _referencia/)
 *   · WebP      → public/img-artigos/        (versionado, é o que é servido)
 *
 * Por que não `src/content/artigos/imagens/`: aquilo funciona para a capa
 * porque o frontmatter passa pelo `image()` do schema. Estas aqui estão em
 * <img> cru dentro do markdown, que o Astro não resolve — caminho relativo
 * ali simplesmente quebra. Referência absoluta servida de public/ funciona
 * hoje, com o HTML estático, e continua funcionando quando existir a página
 * de artigo do item 4.5.
 *
 * Diretório próprio, e não `public/img/`, porque aquele é território do
 * `processa-framer.mjs` — que o regenera a cada rodada do pipeline.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const SIMULAR = process.argv.includes('--simular');
const ARTIGOS = 'src/content/artigos';
const ORIGINAIS = '_importar/imagens/corpo';
const SERVIDAS = 'public/img-artigos';
const QUALIDADE = 82; // o mesmo do otimiza-imagens.mjs

const RE = /https:\/\/framerusercontent\.com\/images\/[A-Za-z0-9]+\.[A-Za-z0-9]+/g;

/** Assinatura do arquivo, não a extensão da URL — a CDN do Framer já mentiu. */
function formatoReal(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 12 && buf.toString('latin1', 4, 8) === 'ftyp') return 'avif';
  if (buf.length > 4 && buf.toString('latin1', 0, 5) === 'GIF89') return 'gif';
  return null;
}

const arquivos = readdirSync(ARTIGOS).filter((f) => f.endsWith('.md'));
const usos = new Map(); // url -> [arquivos que usam]
for (const f of arquivos) {
  for (const url of readFileSync(join(ARTIGOS, f), 'utf8').match(RE) ?? []) {
    if (!usos.has(url)) usos.set(url, []);
    if (!usos.get(url).includes(f)) usos.get(url).push(f);
  }
}

console.log(`${usos.size} URL(s) distinta(s) no corpo de ${new Set([...usos.values()].flat()).size} artigo(s)`);
if (SIMULAR) {
  for (const [url, fs] of usos) console.log(`   · ${url.split('/').pop()} → ${fs.length} artigo(s)`);
  process.exit(0);
}

mkdirSync(ORIGINAIS, { recursive: true });
mkdirSync(SERVIDAS, { recursive: true });

const mapa = new Map(); // url -> /img-artigos/nome.webp
const falhas = [];
let bytesAntes = 0, bytesDepois = 0;

for (const url of usos.keys()) {
  const base = url.split('/').pop().replace(/\.[A-Za-z0-9]+$/, '');
  const destinoWebp = join(SERVIDAS, `${base}.webp`);

  if (existsSync(destinoWebp)) { mapa.set(url, `/img-artigos/${base}.webp`); continue; }

  let buf;
  try {
    // Sem cabeçalho Accept: queremos o original, não o AVIF que a CDN
    // entrega para navegador (armadilha 8 do HANDOFF).
    const r = await fetch(url, { headers: { 'user-agent': 'isabellapires-migracao/1.0' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    falhas.push(`${base} — ${e.message}`);
    continue;
  }

  const ext = formatoReal(buf);
  if (!ext) { falhas.push(`${base} — ${buf.length} bytes que não são imagem`); continue; }

  writeFileSync(join(ORIGINAIS, `${base}.${ext}`), buf);

  let webp;
  try {
    webp = await sharp(buf).webp({ quality: QUALIDADE }).toBuffer();
  } catch (e) {
    falhas.push(`${base} — WebP falhou: ${e.message}`);
    continue;
  }
  writeFileSync(destinoWebp, webp);
  bytesAntes += buf.length;
  bytesDepois += webp.length;
  mapa.set(url, `/img-artigos/${base}.webp`);
}

// Só reescreve depois que tudo baixou: markdown apontando para arquivo que
// não existe é pior que markdown apontando para a CDN que ainda responde.
let reescritos = 0, trocas = 0;
for (const f of arquivos) {
  const caminho = join(ARTIGOS, f);
  const texto = readFileSync(caminho, 'utf8');
  let novo = texto;
  for (const [url, local] of mapa) {
    if (!novo.includes(url)) continue;
    novo = novo.split(url).join(local);
    trocas++;
  }
  if (novo !== texto) { writeFileSync(caminho, novo); reescritos++; }
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`✓ ${mapa.size} imagem(ns) local(is) em ${SERVIDAS}`);
if (bytesAntes) console.log(`✓ ${mb(bytesAntes)} → ${mb(bytesDepois)} em WebP  (${Math.round((1 - bytesDepois / bytesAntes) * 100)}% menor)`);
console.log(`✓ original(is) guardado(s) em ${ORIGINAIS} (fora do git)`);
console.log(`✓ ${trocas} referência(s) reescrita(s) em ${reescritos} artigo(s)`);

const sobrando = arquivos.reduce((n, f) => n + (readFileSync(join(ARTIGOS, f), 'utf8').match(RE) ?? []).length, 0);
console.log(sobrando ? `\n⚠ ainda restam ${sobrando} referência(s) ao framerusercontent.com` : `\n✓ nenhum artigo depende mais do framerusercontent.com`);

if (falhas.length) {
  console.log(`\n✗ ${falhas.length} falha(s):`);
  falhas.forEach((x) => console.log(`   · ${x}`));
  process.exit(1);
}

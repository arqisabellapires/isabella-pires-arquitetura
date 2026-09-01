#!/usr/bin/env node
/**
 * Baixa as capas do CMS do Framer para dentro da coleção do Astro.
 *
 *   node tools/baixa-capas.mjs _importar/Blog.csv artigos
 *   node tools/baixa-capas.mjs _importar/Projetos.csv projetos
 *
 * Por que não usar `_importar/imagens-para-baixar.txt`: aquele arquivo é um
 * Set de URLs, sem o slug ao lado. O schema usa `image()`, que resolve o
 * caminho relativo do frontmatter — cada arquivo precisa cair no nome certo,
 * então o par slug↔URL tem que sair do CSV, que é a única fonte que o tem.
 *
 * O `importa-framer.mjs` escreve `capa: ./imagens/<slug>.jpg` para todo mundo,
 * mas parte das capas é PNG. Aqui a extensão real manda: o arquivo é gravado
 * com ela e o frontmatter é corrigido para apontar para o arquivo que existe.
 *
 * A CDN do Framer serve AVIF para quem manda `Accept: image/avif` e o
 * original para os demais (a armadilha 8 do HANDOFF). Não mandamos Accept:
 * queremos o original, que é o que o pipeline do Astro sabe otimizar.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const [arquivo, colecao] = process.argv.slice(2);
if (!arquivo || !colecao) {
  console.error('uso: node tools/baixa-capas.mjs <arquivo.csv> <artigos|projetos>');
  process.exit(1);
}
if (!existsSync(arquivo)) {
  console.error(`✗ não encontrei ${arquivo}`);
  process.exit(1);
}

/** Mesmo parser do importa-framer.mjs — respeita aspas e quebras internas. */
function parseCsv(texto) {
  const linhas = [];
  let campo = '', linha = [], dentroDeAspas = false;
  const t = texto.replace(/\r\n/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else { dentroDeAspas = false; }
      } else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

/** Mesma regra de slug do importa-framer.mjs, senão os nomes não batem. */
const paraSlug = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase().trim()
   .replace(/[^a-z0-9]+/g, '-')
   .replace(/^-+|-+$/g, '')
   .slice(0, 80);

const acha = (cabecalho, alvos) =>
  cabecalho.findIndex((h) => alvos.includes(h.toLowerCase().trim()));

/** Assinatura do arquivo, não a extensão da URL: a CDN já mentiu antes. */
function formatoReal(buf) {
  if (buf.length > 8 && buf[0] === 0x89 && buf.toString('latin1', 1, 4) === 'PNG') return 'png';
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  if (buf.length > 12 && buf.toString('latin1', 4, 8) === 'ftyp' && buf.toString('latin1', 8, 12).startsWith('avif')) return 'avif';
  if (buf.length > 4 && buf.toString('latin1', 0, 5) === 'GIF89') return 'gif';
  if (buf.toString('latin1', 0, 200).includes('<svg')) return 'svg';
  return null;
}

const linhas = parseCsv(readFileSync(arquivo, 'utf8'));
const cabecalho = linhas[0];
const iSlug = acha(cabecalho, ['slug', 'path', 'url']);
const iTitulo = acha(cabecalho, ['title', 'titulo', 'título', 'nome', 'name']);
const iCapa = acha(cabecalho, ['image', 'cover', 'capa', 'thumbnail', 'imagem', 'featured image']);

if (iCapa < 0) {
  console.error(`✗ o CSV não tem coluna de capa. Cabeçalho: ${cabecalho.join(' | ')}`);
  process.exit(1);
}

const destinoMd = join('src/content', colecao);
const destinoImg = join(destinoMd, 'imagens');
mkdirSync(destinoImg, { recursive: true });

const baixados = [], pulados = [], falhas = [], corrigidos = [], semCapa = [], semMd = [];

for (const linha of linhas.slice(1)) {
  const titulo = (linha[iTitulo] ?? '').trim();
  if (!titulo) continue;
  const slugAntigo = (iSlug >= 0 ? linha[iSlug] ?? '' : '').trim();
  const slug = paraSlug(slugAntigo || titulo);
  const url = (linha[iCapa] ?? '').trim();

  if (!url) { semCapa.push(slug); continue; }

  const md = join(destinoMd, `${slug}.md`);
  if (!existsSync(md)) semMd.push(slug);

  const jaExiste = ['jpg', 'png', 'webp', 'avif', 'gif', 'svg']
    .map((e) => join(destinoImg, `${slug}.${e}`))
    .find((p) => existsSync(p) && statSync(p).size > 0);
  if (jaExiste) { pulados.push(slug); continue; }

  let buf;
  try {
    const r = await fetch(url, { headers: { 'user-agent': 'isabellapires-migracao/1.0' } });
    if (!r.ok) { falhas.push(`${slug}: HTTP ${r.status}`); continue; }
    buf = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    falhas.push(`${slug}: ${e.message}`);
    continue;
  }

  const ext = formatoReal(buf);
  if (!ext) { falhas.push(`${slug}: ${buf.length} bytes que não são imagem reconhecível`); continue; }

  const caminho = join(destinoImg, `${slug}.${ext}`);
  writeFileSync(caminho, buf);
  baixados.push(`${slug}.${ext} (${(buf.length / 1024).toFixed(0)} kB)`);

  // O frontmatter foi escrito com .jpg fixo. Alinhar com o arquivo real,
  // senão `image()` não resolve e o build quebra assim que alguém consumir.
  if (existsSync(md)) {
    const texto = readFileSync(md, 'utf8');
    const alvo = `capa: "./imagens/${slug}.${ext}"`;
    const novo = texto.replace(/^capa: ".*"$/m, alvo);
    if (novo !== texto) { writeFileSync(md, novo); corrigidos.push(`${slug} → .${ext}`); }
  }
}

console.log(`✓ ${baixados.length} capa(s) baixada(s) em ${destinoImg}`);
baixados.forEach((b) => console.log(`   · ${b}`));
if (pulados.length) console.log(`\n· ${pulados.length} já estava(m) em disco, mantida(s)`);
if (corrigidos.length) {
  console.log(`\n✓ ${corrigidos.length} frontmatter(s) corrigido(s) para a extensão real:`);
  corrigidos.forEach((c) => console.log(`   · ${c}`));
}
if (semCapa.length) console.log(`\n⚠ ${semCapa.length} registro(s) sem URL de capa: ${semCapa.join(', ')}`);
if (semMd.length) console.log(`\n⚠ ${semMd.length} slug(s) do CSV sem markdown correspondente: ${semMd.join(', ')}`);
if (falhas.length) {
  console.log(`\n✗ ${falhas.length} falha(s):`);
  falhas.forEach((f) => console.log(`   · ${f}`));
  process.exit(1);
}

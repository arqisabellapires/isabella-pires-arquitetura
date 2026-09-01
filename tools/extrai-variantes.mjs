#!/usr/bin/env node
/**
 * Extrai o mapa de variantes dos componentes do Framer.
 *
 *   node tools/extrai-variantes.mjs
 *
 * Cada componente do Framer é uma máquina de estado. O fonte traz duas
 * tabelas que, juntas, dizem qual classe CSS corresponde a qual estado:
 *
 *   humanReadableVariantMap   "Botão - Hover" → "kAbC123"
 *   variantClassNames         "kAbC123"       → "framer-v-10hijyr"
 *
 * O CSS de todas as variantes já vem servido na página, inclusive das que
 * o HTML não usa — são justamente os estados de hover e aberto. Com o mapa
 * abaixo, reviver a interação é trocar a classe.
 *
 * Saída: public/variantes.json (esta tabela é fato sobre o design, não
 * código do Framer)
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = '_fonte-framer/https:/framerusercontent.com/modules';
if (!existsSync(RAIZ)) {
  console.error('falta _fonte-framer/. Rode: node tools/baixa-runtime.mjs && node tools/extrai-fontes.mjs');
  process.exit(1);
}

/** Lê `const nome={a:"x",b:"y"}` sem executar nada do arquivo. */
function objetoLiteral(fonte, nome) {
  const i = fonte.indexOf(`const ${nome}={`);
  if (i < 0) return null;
  let j = fonte.indexOf('{', i), nivel = 0, fim = -1;
  for (let k = j; k < fonte.length; k++) {
    if (fonte[k] === '{') nivel++;
    else if (fonte[k] === '}') { nivel--; if (!nivel) { fim = k + 1; break; } }
  }
  if (fim < 0) return null;
  const bruto = fonte.slice(j, fim);
  const pares = {};
  for (const m of bruto.matchAll(/["']?([A-Za-z0-9_$ ÀÁÂÃÉÊÍÓÔÕÚÇàáâãéêíóôõúç.\-–—/()]+)["']?\s*:\s*["']([^"']*)["']/g))
    pares[m[1].trim()] = m[2];
  return pares;
}

function percorre(dir, saida = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const c = join(dir, item.name);
    if (item.isDirectory()) percorre(c, saida);
    else if (item.name.endsWith('.js') && statSync(c).size < 3_000_000) saida.push(c);
  }
  return saida;
}

const componentes = [];
for (const arquivo of percorre(RAIZ)) {
  const fonte = readFileSync(arquivo, 'utf8');
  const classes = objetoLiteral(fonte, 'variantClassNames');
  if (!classes || !Object.keys(classes).length) continue;
  const legivel = objetoLiteral(fonte, 'humanReadableVariantMap') ?? {};

  // id → nome legível (a tabela vem invertida no fonte)
  const nomePorId = Object.fromEntries(Object.entries(legivel).map(([nome, id]) => [id, nome]));
  const variantes = Object.entries(classes).map(([id, classe]) => ({
    id, classe, nome: nomePorId[id] ?? id,
  }));
  if (variantes.length < 2) continue;

  componentes.push({ arquivo: arquivo.replace(`${RAIZ}/`, ''), variantes });
}

/** O fonte escapa acento como \xe1; sem desfazer, "Serviços" vira "xf3s". */
const desescapa = (s) =>
  s.replace(/\\?x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Classifica o papel de uma variante pelo nome que a designer deu. */
function papel(nome) {
  const n = nome.toLowerCase();
  if (/hover|hovered/.test(n)) return 'hover';
  if (/aberto|open|expandid|active|ativo/.test(n)) return 'aberto';
  if (/fechado|closed|default|padr[aã]o|normal/.test(n)) return 'fechado';
  return 'base';
}

/** Chave do que a variante representa, ignorando o papel e o breakpoint. */
function assunto(nome) {
  return nome
    .toLowerCase()
    .replace(/\b(hover|hovered|aberto|open|fechado|closed|default)\b/g, '')
    .replace(/\b(desktop|tablet|mobile|phone)\b/g, '')
    .replace(/[-–—/|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Breakpoint que a variante atende, quando o nome diz. */
function larguraDe(nome) {
  const n = nome.toLowerCase();
  if (/\bmobile|phone\b/.test(n)) return 'mobile';
  if (/\btablet\b/.test(n)) return 'tablet';
  if (/\bdesktop\b/.test(n)) return 'desktop';
  return null;
}

for (const c of componentes) {
  c.variantes.forEach((v) => {
    v.nome = desescapa(v.nome);
    v.papel = papel(v.nome);
    v.assunto = assunto(v.nome);
    v.largura = larguraDe(v.nome);
  });
}

/**
 * Pareia estado de repouso com estado de resposta. Duas variantes formam
 * par quando falam do mesmo assunto no mesmo breakpoint e uma delas é
 * hover ou aberto. É assim que "Casa IP - Desktop" acha
 * "Casa IP Desktop - Hover".
 */
const pares = [];
for (const c of componentes) {
  for (const alvo of c.variantes) {
    if (alvo.papel !== 'hover' && alvo.papel !== 'aberto') continue;
    const repouso = c.variantes.find(
      (v) => v !== alvo && v.assunto === alvo.assunto && v.largura === alvo.largura &&
             (v.papel === 'base' || v.papel === 'fechado'),
    );
    if (!repouso) continue;
    pares.push({
      componente: c.arquivo.split('/').pop(),
      gatilho: alvo.papel === 'hover' ? 'hover' : 'clique',
      de: repouso.classe, para: alvo.classe,
      assunto: alvo.assunto || alvo.nome, largura: alvo.largura,
    });
  }
}

const comHover = pares.filter((p) => p.gatilho === 'hover').length;
const comAberto = pares.filter((p) => p.gatilho === 'clique').length;
writeFileSync('public/variantes.json', JSON.stringify({ pares }, null, 1));

console.log(`✓ ${componentes.length} componentes, ${componentes.reduce((n, c) => n + c.variantes.length, 0)} variantes`);
console.log(`✓ ${pares.length} pares: ${comHover} de hover, ${comAberto} de clique\n`);
pares.slice(0, 18).forEach((p) =>
  console.log(`  [${p.gatilho.padEnd(6)}] ${p.de.padEnd(18)} → ${p.para.padEnd(18)} ${p.assunto.slice(0, 34)}`));

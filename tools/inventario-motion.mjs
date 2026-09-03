#!/usr/bin/env node
/**
 * Inventário do que se move no Framer — a varredura que o item 4.4 pede.
 *
 *   node tools/inventario-motion.mjs            # relatório em texto
 *   node tools/inventario-motion.mjs --json     # _capturas/motion.json
 *
 * O `extrai-variantes.mjs` responde "quais pares repouso→resposta existem",
 * e só enxerga par cujo NOME tem hover/aberto. Isso deixa de fora a classe
 * de interação mais visível do site: o componente que troca de CONTEÚDO.
 * O carrossel de projetos tem variantes `Casa IP`, `AP MM`, `STUDIO`,
 * `COZINHA LA` — nenhuma delas diz "hover", então nenhuma virava par, e o
 * inventário parava em 10 entradas achando que estava completo.
 *
 * Aqui a pergunta é outra: de tudo que o Framer declara como máquina de
 * estado, o que é par de resposta, o que é trocador de conteúdo, e o que
 * disso já está vivo no nosso site. É a diferença entre amostragem e
 * varredura.
 *
 * Não executa nada do Framer: lê os literais do fonte desempacotado.
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = '_fonte-framer/https:/framerusercontent.com/modules';
if (!existsSync(RAIZ)) {
  console.error('falta _fonte-framer/. Rode: node tools/baixa-runtime.mjs && node tools/extrai-fontes.mjs');
  process.exit(1);
}
const JSON_SAIDA = process.argv.includes('--json');

/** Lê `const nome={...}` sem executar — mesmo método do extrai-variantes. */
function objetoLiteral(fonte, nome) {
  const i = fonte.indexOf(`const ${nome}={`);
  if (i < 0) return null;
  const j = fonte.indexOf('{', i);
  let nivel = 0, fim = -1;
  for (let k = j; k < fonte.length; k++) {
    if (fonte[k] === '{') nivel++;
    else if (fonte[k] === '}') { nivel--; if (!nivel) { fim = k + 1; break; } }
  }
  if (fim < 0) return null;
  const pares = {};
  for (const m of fonte.slice(j, fim).matchAll(
    /["']?((?:\\x[0-9a-fA-F]{2}|[A-Za-z0-9_$ ÀÁÂÃÉÊÍÓÔÕÚÇàáâãéêíóôõúç.\-–—/()])+)["']?\s*:\s*["']([^"']*)["']/g))
    pares[m[1].trim()] = m[2];
  return pares;
}

/** `\xe7` no fonte é `ç`. Sem desfazer, "Serviços" vira lixo. */
const desescapa = (s) => s.replace(/\\?x([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

/** Toda transição declarada no módulo, na ordem em que aparece. */
function transicoes(fonte) {
  const achadas = [];
  for (const m of fonte.matchAll(/transition\d*\s*=\s*\{([^{}]{0,200})\}/g)) {
    const t = {};
    for (const p of m[1].matchAll(/([a-zA-Z]+)\s*:\s*("?[\w.]+"?)/g)) {
      t[p[1]] = p[2].replace(/"/g, '');
    }
    if (t.type) achadas.push(t);
  }
  // dedup: o mesmo spring costuma repetir em várias propriedades
  const vistas = new Set();
  return achadas.filter((t) => {
    const k = JSON.stringify(t);
    if (vistas.has(k)) return false;
    vistas.add(k); return true;
  });
}

const papel = (n) => {
  const s = n.toLowerCase();
  if (/hover|hovered/.test(s)) return 'hover';
  if (/aberto|open|expandid|active|ativo/.test(s)) return 'aberto';
  if (/fechado|closed|default|padr[aã]o|normal/.test(s)) return 'fechado';
  return 'base';
};
const larguraDe = (n) => {
  const s = n.toLowerCase();
  if (/\bmobile|phone\b/.test(s)) return 'mobile';
  if (/\btablet\b/.test(s)) return 'tablet';
  if (/\bdesktop\b/.test(s)) return 'desktop';
  return null;
};
/** O nome sem o papel e sem o breakpoint — o que a variante É. */
const assunto = (n) => n.toLowerCase()
  .replace(/\b(hover|hovered|aberto|open|fechado|closed|default)\b/g, '')
  .replace(/\b(desktop|tablet|mobile|phone)\b/g, '')
  .replace(/[-–—/|]+/g, ' ').replace(/\s+/g, ' ').trim();

function percorre(dir, saida = []) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const c = join(dir, item.name);
    if (item.isDirectory()) percorre(c, saida);
    else if (item.name.endsWith('.js') && statSync(c).size < 3_000_000) saida.push(c);
  }
  return saida;
}

// ── o que o nosso site já serve: toda classe framer-v-* presente no HTML ──
const nossasClasses = new Set();
const paginas = [];
function varreHtml(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const c = join(dir, item.name);
    if (item.isDirectory() && !['img', 'img-artigos', 'fonts'].includes(item.name)) varreHtml(c);
    else if (item.name === 'index.html') {
      paginas.push(c);
      for (const m of readFileSync(c, 'utf8').matchAll(/framer-v-[A-Za-z0-9]+/g)) nossasClasses.add(m[0]);
    }
  }
}
varreHtml('public');

const componentes = [];
for (const arquivo of percorre(RAIZ)) {
  const fonte = readFileSync(arquivo, 'utf8');
  const classes = objetoLiteral(fonte, 'variantClassNames');
  if (!classes || Object.keys(classes).length < 2) continue;
  const legivel = objetoLiteral(fonte, 'humanReadableVariantMap') ?? {};
  const nomePorId = Object.fromEntries(Object.entries(legivel).map(([n, id]) => [id, desescapa(n)]));

  const variantes = Object.entries(classes).map(([id, classe]) => {
    const nome = nomePorId[id] ?? id;
    return { id, classe, nome, papel: papel(nome), assunto: assunto(nome), largura: larguraDe(nome),
             noNossoDom: nossasClasses.has(classe) };
  });

  // Trocador: 3+ assuntos distintos entre variantes que NÃO são resposta.
  // É a forma do carrossel e das abas — peers, não repouso→resposta.
  const base = variantes.filter((v) => v.papel === 'base' || v.papel === 'fechado');
  const assuntos = new Set(base.map((v) => v.assunto).filter(Boolean));
  const pares = [];
  for (const alvo of variantes) {
    if (alvo.papel !== 'hover' && alvo.papel !== 'aberto') continue;
    const repouso = variantes.find((v) => v !== alvo && v.assunto === alvo.assunto &&
      v.largura === alvo.largura && (v.papel === 'base' || v.papel === 'fechado'));
    if (repouso) pares.push({ de: repouso.classe, para: alvo.classe, assunto: alvo.assunto,
                              papel: alvo.papel, largura: alvo.largura,
                              vivoNoDom: repouso.noNossoDom });
  }

  componentes.push({
    arquivo: arquivo.replace(`${RAIZ}/`, '').split('/').pop(),
    variantes, pares,
    trocador: assuntos.size >= 3 ? [...assuntos] : null,
    transicoes: transicoes(fonte),
    presenteNoDom: variantes.some((v) => v.noNossoDom),
  });
}

if (JSON_SAIDA) {
  writeFileSync('_capturas/motion.json', JSON.stringify(componentes, null, 2));
  console.log(`✓ ${componentes.length} componentes em _capturas/motion.json`);
  process.exit(0);
}

const comPar = componentes.filter((c) => c.pares.length);
const trocadores = componentes.filter((c) => c.trocador);
const noDom = componentes.filter((c) => c.presenteNoDom);

console.log(`${paginas.length} páginas varridas, ${nossasClasses.size} classes de variante servidas no nosso HTML\n`);
console.log(`${componentes.length} componentes com máquina de estado no Framer`);
console.log(`  ${noDom.length} têm alguma variante presente no nosso DOM`);
console.log(`  ${comPar.length} têm par repouso→resposta (hover/aberto)`);
console.log(`  ${trocadores.length} são TROCADORES de conteúdo (carrossel/abas) — invisíveis ao extrai-variantes\n`);

console.log('── trocadores de conteúdo ──');
for (const c of trocadores) {
  const vivo = c.presenteNoDom ? 'no DOM' : 'ausente';
  console.log(`\n  ${c.arquivo}  [${vivo}]`);
  console.log(`    estados: ${c.trocador.slice(0, 6).map((s) => s || '(sem nome)').join(' · ')}${c.trocador.length > 6 ? ` … +${c.trocador.length - 6}` : ''}`);
  const quantos = c.variantes.filter((v) => v.noNossoDom).length;
  console.log(`    variantes: ${c.variantes.length} no Framer, ${quantos} presente(s) no nosso HTML`);
  if (c.transicoes.length) console.log(`    movimento: ${c.transicoes.map((t) => Object.entries(t).filter(([k]) => k !== 'delay').map(([k, v]) => `${k} ${v}`).join(' ')).slice(0, 2).join('  |  ')}`);
}

console.log('\n── pares repouso→resposta ──');
for (const c of comPar) {
  const vivos = c.pares.filter((p) => p.vivoNoDom).length;
  console.log(`  ${c.arquivo.padEnd(20)} ${String(c.pares.length).padStart(2)} par(es), ${vivos} com repouso no nosso DOM  ·  ${[...new Set(c.pares.map((p) => p.papel))].join('/')}`);
}

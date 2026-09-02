#!/usr/bin/env node
/**
 * O portão do arquivo de tokens: o navegador aceita isto?
 *
 *   node tools/valida-tokens.mjs
 *   node tools/valida-tokens.mjs src/styles/tokens.css
 *
 * Existe porque "o CSS parece certo" não é verificação. Na primeira rodada do
 * deriva-tokens o arquivo tinha três defeitos que passavam por qualquer
 * leitura humana, e nenhum deles dava erro em lugar nenhum — CSS inválido é
 * descartado em silêncio, que é a pior propriedade que um formato pode ter:
 *
 * 1. O cabeçalho citava o glob das medidas, e a barra colada no asterisco
 *    FECHAVA o comentário na terceira linha. O bloco :root inteiro virava
 *    lixo sintático: 517 custom properties descartadas — e o arquivo parecia
 *    bom, porque ainda não havia componente consumindo nenhuma delas.
 * 2. Toda mola com bounce 0 saía com NaN no lugar dos pontos da curva:
 *    divisão por zero no amortecimento crítico. Eram 4 das 10.
 * 3. Cor e tipografia contavam elemento que não pinta texto, então a paleta
 *    incluía o azul de link padrão do navegador. Esse não é sintático; quem
 *    pega é o relatório de procedência.
 *
 * Mede três coisas, todas no Chromium, que é quem decide de verdade:
 *   - o :root sobrevive ao parser, e quantas propriedades chegam ao documento;
 *   - nenhum valor virou NaN;
 *   - cada mola é aceita como easing de transição de verdade.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';

const ARQUIVO = process.argv[2] ?? 'src/styles/tokens.derivados.css';
if (!existsSync(ARQUIVO)) { console.error(`não existe: ${ARQUIVO}`); process.exit(1); }
const css = readFileSync(ARQUIVO, 'utf8');

const nav = await chromium.launch();
const pg = await nav.newPage();
await pg.setContent('<div id=alvo>x</div>');
const r = await pg.evaluate((c) => {
  const s = document.createElement('style');
  s.textContent = c;
  document.head.appendChild(s);
  const regras = [...s.sheet.cssRules];
  const root = regras.find((x) => x.selectorText === ':root');
  if (!root) return { semRoot: true, regras: regras.map((x) => x.selectorText || x.cssText.slice(0, 40)) };
  const props = [...root.style];
  const nan = props.filter((p) => /NaN/i.test(root.style.getPropertyValue(p)));
  const molas = props.filter((p) => /^--mola-\d+$/.test(p));
  const d = document.getElementById('alvo');
  const rejeitadas = [];
  for (const m of molas) {
    const v = root.style.getPropertyValue(m).trim();
    d.style.transitionTimingFunction = 'ease';
    d.style.transitionTimingFunction = v;
    if (d.style.transitionTimingFunction === 'ease') rejeitadas.push(m);
  }
  const cs = getComputedStyle(document.documentElement);
  const chegam = props.filter((p) => cs.getPropertyValue(p).trim() !== '').length;
  return { props: props.length, chegam, nan, molas: molas.length, rejeitadas };
}, css);
await nav.close();

if (r.semRoot) {
  console.error(`✗ ${ARQUIVO}: o navegador não achou a regra :root.`);
  console.error('  O parser descartou o bloco. Quase sempre é comentário fechado');
  console.error('  cedo demais por uma barra colada em asterisco dentro do texto.');
  console.error('  Regras que sobreviveram: ' + JSON.stringify(r.regras));
  process.exit(1);
}

const problemas = [];
if (r.nan.length) problemas.push(`${r.nan.length} propriedades com NaN: ${r.nan.slice(0, 5).join(', ')}`);
if (r.rejeitadas.length) problemas.push(`${r.rejeitadas.length} molas recusadas como easing: ${r.rejeitadas.join(', ')}`);
if (r.chegam !== r.props) problemas.push(`${r.props - r.chegam} propriedades não chegam ao documento`);

console.log(`${ARQUIVO}`);
console.log(`  ${r.props} propriedades, ${r.chegam} chegam ao documento`);
console.log(`  ${r.molas} molas, ${r.molas - r.rejeitadas.length} aceitas como easing pelo navegador`);
if (problemas.length) { console.log(); problemas.forEach((p) => console.log('  ✗ ' + p)); process.exit(1); }
console.log('\n✓ o navegador aceita o arquivo inteiro');

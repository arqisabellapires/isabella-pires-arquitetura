#!/usr/bin/env node
/**
 * Portão do carrossel: o nosso tem que se comportar igual ao do Framer.
 *
 *   node tools/verifica-carrossel.mjs
 *
 * O verifica-fidelidade.mjs compara pixels em repouso e não enxerga
 * movimento nenhum — uma página pode passar nele com o carrossel morto.
 * Aqui a comparação é de comportamento: para cada controle, a transição
 * de estado tem que bater com a que foi medida no Framer vivo e guardada
 * em _capturas/carrossel-sonda.json.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync, existsSync } from 'node:fs';
import { sobe, encerraServidores } from './servidor.mjs';
import { BREAKPOINTS } from './paginas.mjs';

const REF = '_capturas/carrossel-sonda.json';
if (!existsSync(REF)) {
  console.error(`falta ${REF}. Rode: FRAMER_BASE=... node tools/sonda-carrossel.mjs`);
  process.exit(1);
}
const esperado = JSON.parse(readFileSync(REF, 'utf8'));
const mapa = JSON.parse(readFileSync('public/carrossel.json', 'utf8'));
const TODAS = Object.keys(mapa.projetos);
const SEL = TODAS.map((c) => '.' + c).join(',');

/**
 * O nosso HTML empilha as três árvores de breakpoint na mesma página — é
 * assim que o funde-breakpoints.mjs monta o responsivo. Então querySelector
 * devolve a raiz do desktop mesmo a 390px, e o teste clicaria em algo que
 * não está no layout. O Framer não tem esse problema porque renderiza só a
 * árvore ativa, e foi por isso que a sonda contra ele funcionou direto.
 */
const RAIZ_VISIVEL = `(() => {
  const cs = ${JSON.stringify(TODAS)};
  return [...document.querySelectorAll(cs.map(c => '.' + c).join(','))]
    .find(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }) ?? null;
})()`;
const nomeDe = (c) => `${mapa.projetos[c]}${TODAS.indexOf(c) < 4 ? '' : ' ·m'}`;

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const porta = await sobe('public', '/index.html', 8940);
const base = `http://localhost:${porta}`;
console.log(`nosso site em ${base}\n`);

const navegador = await chromium.launch();
let ok = 0, falhas = [], erros = [];

for (const bp of BREAKPOINTS) {
  const alvos = esperado[bp.nome] ?? [];
  if (!alvos.length) { console.log(`── ${bp.nome} ── sem referência medida`); continue; }
  console.log(`── ${bp.nome} (${bp.largura}px) ──`);

  const ctx = await navegador.newContext({
    viewport: { width: bp.largura, height: bp.altura },
    isMobile: bp.movel, hasTouch: bp.movel,
    userAgent: bp.movel ? UA_MOVEL : undefined,
  });

  for (const alvo of alvos) {
    const p = await ctx.newPage();
    let obtido = null;
    try {
      await p.goto(`${base}/index.html`, { waitUntil: 'load', timeout: 30000 });
      await p.waitForSelector(SEL, { state: 'attached', timeout: 10000 });
      await p.waitForFunction((e) => !!eval(e), RAIZ_VISIVEL, { timeout: 10000 });
      await p.waitForTimeout(700);
      const estado = () => p.evaluate((expr) => {
        const r = eval(expr);
        return r ? [...r.classList].find((c) => c.startsWith('framer-v-')) ?? '' : null;
      }, RAIZ_VISIVEL);
      const antes = await estado();
      const h = await p.evaluateHandle((o) => {
        const r = eval(o.expr);
        if (!r) return null;
        return [...r.querySelectorAll('[data-framer-name]')]
          .filter((e) => getComputedStyle(e).cursor === 'pointer')[o.i];
      }, { expr: RAIZ_VISIVEL, i: alvo.indice });
      const el = h.asElement();
      if (el) {
        await el.scrollIntoViewIfNeeded();
        // Clique real, com force: a página empilha as três árvores de
        // breakpoint e a checagem de acionabilidade recusa o alvo mesmo
        // quando ele é o que está no layout. Real importa: despachar o
        // evento no próprio elemento entrega e.target = o frame, enquanto
        // o ponteiro acerta o rótulo dentro dele — que é o que o visitante
        // de verdade acerta.
        await el.click({ force: true, timeout: 4000 });
        await p.waitForTimeout(700);
        const depois = await estado();
        obtido = depois === antes ? null : depois;
      }
    } catch (e) { erros.push(`${bp.nome} · ${alvo.controle}: ${e.message.split('\n')[0]}`); }
    await p.close();

    const bate = obtido === alvo.para;
    const rotulo = `  [${alvo.indice}] ${alvo.controle}`.padEnd(28);
    const esp = alvo.para ? nomeDe(alvo.para) : '(sem efeito)';
    const got = obtido ? nomeDe(obtido) : '(sem efeito)';
    if (bate) { ok++; console.log(`${rotulo}✓ ${esp}`); }
    else { falhas.push(`${bp.nome} · ${alvo.controle}: Framer dá ${esp}, nosso dá ${got}`);
           console.log(`${rotulo}✗ esperado ${esp}, obtido ${got}`); }
  }
  await ctx.close();
}

await navegador.close();
encerraServidores();

const total = ok + falhas.length;
console.log(`\n${ok}/${total} controles com o mesmo comportamento do Framer`);
if (erros.length) { console.log('\nerros durante a medição:'); erros.forEach((e) => console.log(`  · ${e}`)); }
if (falhas.length) { falhas.forEach((f) => console.log(`  ✗ ${f}`)); process.exit(1); }

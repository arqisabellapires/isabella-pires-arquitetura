#!/usr/bin/env node
/**
 * Descobre, no Framer vivo, qual controle leva o carrossel a qual estado.
 *
 *   FRAMER_BASE=https://... node tools/sonda-carrossel.mjs
 *
 * O fonte do componente declara 8 onTap e um cycleOrder, mas o render é
 * condicional por variante: o mesmo handler aparece em vários ramos e não
 * dá para dizer estaticamente qual elemento do DOM recebe qual. Em vez de
 * adivinhar, clica e mede — a origem é o Framer, que é quem sabe.
 *
 * Saída: tabela controle → variante resultante, por breakpoint. É o mapa
 * que o interacoes.js precisa para reproduzir o carrossel sem inventar.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { BREAKPOINTS } from './paginas.mjs';

const BASE = (process.env.FRAMER_BASE ?? '').replace(/\/$/, '');
if (!BASE) { console.error('defina FRAMER_BASE'); process.exit(1); }

/** As 8 variantes do controlador, do fonte (nkDfbQNR8.js). */
const VARIANTES = {
  'framer-v-8p8k2y': 'Casa IP · desktop',
  'framer-v-1thzb68': 'STUDIO · desktop',
  'framer-v-4oun70': 'AP MM · desktop',
  'framer-v-1pr5vsu': 'COZINHA LA · desktop',
  'framer-v-sm6rr6': 'Casa IP · mobile',
  'framer-v-r5q2vu': 'STUDIO · mobile',
  'framer-v-1xok40r': 'AP MM · mobile',
  'framer-v-4dtimf': 'COZINHA LA · mobile',
};

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const navegador = await chromium.launch();
const achados = {};

for (const bp of BREAKPOINTS) {
  const ctx = await navegador.newContext({
    viewport: { width: bp.largura, height: bp.altura },
    isMobile: bp.movel, hasTouch: bp.movel,
    userAgent: bp.movel ? UA_MOVEL : undefined,
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
  await p.waitForTimeout(2500);

  const chaves = Object.keys(VARIANTES);
  const raizSel = chaves.map((c) => `.${c}`).join(',');
  const existe = await p.locator(raizSel).count();
  if (!existe) { console.log(`\n── ${bp.nome} ── carrossel não encontrado`); await ctx.close(); continue; }

  // Um clique reordena os filhos, então o elemento sob o cursor muda de
  // papel a cada troca. Medir em sequência dá um mapa que se contradiz.
  // Cada candidato parte, portanto, do estado padrão, com página nova.
  const estado = async (pg) => pg.evaluate((s) => {
    const r = document.querySelector(s);
    return r ? [...r.classList].find((c) => c.startsWith('framer-v-')) ?? '' : null;
  }, raizSel);

  /** Os clicáveis são os que o Framer marcou com cursor:pointer — é onde
   *  ele pendurou onTap. Não adivinhamos: perguntamos ao estilo aplicado. */
  const listaClicaveis = (pg) => pg.evaluate((s) => {
    const r = document.querySelector(s);
    return [...r.querySelectorAll('[data-framer-name]')]
      .filter((e) => getComputedStyle(e).cursor === 'pointer')
      .map((e, i) => ({ i, nome: e.getAttribute('data-framer-name') }));
  }, raizSel);

  const clicaveis = await listaClicaveis(p);
  const linhas = [];

  for (const alvo of clicaveis) {
    const pg = await ctx.newPage();
    try {
      await pg.goto(`${BASE}/`, { waitUntil: 'networkidle', timeout: 60000 });
      await pg.waitForSelector(raizSel, { timeout: 20000 });
      await pg.waitForTimeout(1500);
      const antes = await estado(pg);
      const handle = await pg.evaluateHandle((o) => {
        const r = document.querySelector(o.sel);
        return [...r.querySelectorAll('[data-framer-name]')]
          .filter((e) => getComputedStyle(e).cursor === 'pointer')[o.i];
      }, { sel: raizSel, i: alvo.i });
      const el = handle.asElement();
      if (!el) { await pg.close(); continue; }
      await el.scrollIntoViewIfNeeded();
      await el.click({ timeout: 4000 });
      await pg.waitForTimeout(800);
      const depois = await estado(pg);
      if (depois && depois !== antes)
        linhas.push({ indice: alvo.i, controle: alvo.nome, de: antes, para: depois });
      else
        linhas.push({ indice: alvo.i, controle: alvo.nome, de: antes, para: null });
    } catch { /* candidato que não aceita clique fica de fora */ }
    await pg.close();
  }

  achados[bp.nome] = linhas;
  console.log(`\n── ${bp.nome} (${bp.largura}px) ──`);
  if (!linhas.length) console.log('  nenhum controle mudou o estado');
  for (const l of linhas)
    console.log(`  [${l.indice}] ${l.controle}`.padEnd(28) +
      (l.para ? `${VARIANTES[l.de] ?? l.de}  →  ${VARIANTES[l.para] ?? l.para}` : `${VARIANTES[l.de] ?? l.de}  →  (sem efeito)`));
  await ctx.close();
}

await navegador.close();
writeFileSync('_capturas/carrossel-sonda.json', JSON.stringify(achados, null, 2));
console.log('\n✓ _capturas/carrossel-sonda.json');

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

  // Candidatos a controle: tudo clicável dentro da raiz, com nome do Framer.
  const candidatos = await p.evaluate((sel) => {
    const raiz = document.querySelector(sel);
    const vistos = [];
    for (const el of raiz.querySelectorAll('[data-framer-name]')) {
      const b = el.getBoundingClientRect();
      if (b.width < 8 || b.height < 8) continue;
      vistos.push({ nome: el.getAttribute('data-framer-name'),
                    classe: [...el.classList].find((c) => c.startsWith('framer-') && !c.startsWith('framer-v-')) ?? '' });
    }
    return vistos.slice(0, 40);
  }, raizSel);

  const linhas = [];
  for (const cand of candidatos) {
    if (!cand.classe) continue;
    // volta ao estado inicial antes de cada tentativa
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    const antes = await p.evaluate((s) => {
      const r = document.querySelector(s);
      return [...r.classList].find((c) => c.startsWith('framer-v-')) ?? '';
    }, raizSel);
    try {
      await p.locator(`.${cand.classe}`).first().click({ timeout: 2500, force: true });
    } catch { continue; }
    await p.waitForTimeout(700);
    const depois = await p.evaluate((s) => {
      const r = document.querySelector(s);
      return [...r.classList].find((c) => c.startsWith('framer-v-')) ?? '';
    }, raizSel);
    if (depois && depois !== antes) {
      linhas.push({ controle: cand.nome, classe: cand.classe, de: antes, para: depois });
    }
  }

  achados[bp.nome] = linhas;
  console.log(`\n── ${bp.nome} (${bp.largura}px) ──`);
  if (!linhas.length) console.log('  nenhum controle mudou o estado');
  for (const l of linhas)
    console.log(`  ${l.nome ?? l.controle}`.padEnd(26) + `.${l.classe.padEnd(18)} ${VARIANTES[l.de] ?? l.de} → ${VARIANTES[l.para] ?? l.para}`);
  await ctx.close();
}

await navegador.close();
writeFileSync('_capturas/carrossel-sonda.json', JSON.stringify(achados, null, 2));
console.log('\n✓ _capturas/carrossel-sonda.json');

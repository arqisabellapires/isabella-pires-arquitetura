#!/usr/bin/env node
/**
 * Diz *onde* uma página diverge da referência, e o que mora ali no DOM.
 * Complementa o verificador: em vez de abrir o mapa de diferença como
 * imagem, sai tudo em texto.
 *
 *   node tools/diagnostica-diferenca.mjs /servicos/
 *   node tools/diagnostica-diferenca.mjs /servicos/ mobile
 *
 * Exige que .ref/ exista — rode o verificador antes, que é quem o gera.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';
import { sobe, encerraServidores } from './servidor.mjs';

const ROTA = process.argv[2];
const NOME_BP = process.argv[3] ?? 'desktop';
const pagina = PAGINAS.find((p) => p.rota === ROTA);
const bp = BREAKPOINTS.find((b) => b.nome === NOME_BP);
if (!pagina) { console.error(`rota desconhecida: ${ROTA}`); process.exit(1); }
if (!bp) { console.error(`breakpoint desconhecido: ${NOME_BP}`); process.exit(1); }

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const pRef = await sobe('.ref', `/${pagina.pasta}/${bp.nome}.html`, 8941);
const pNovo = await sobe('public', '/index.html', 8961);

const nav = await chromium.launch();
const ctx = await nav.newContext({
  viewport: { width: bp.largura, height: bp.altura },
  isMobile: bp.movel, hasTouch: bp.movel,
  userAgent: bp.movel ? UA_MOVEL : undefined,
  deviceScaleFactor: 1,
});
const p = await ctx.newPage();

async function tira(url) {
  try { await p.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); }
  catch { await p.goto(url, { waitUntil: 'load', timeout: 45000 }); }
  await p.waitForTimeout(1800);
  await p.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, 0);
  });
  await p.waitForTimeout(900);
  const png = await p.screenshot({ fullPage: true });
  const arvore = await p.evaluate(() => {
    const vis = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.height < 8 || r.width < 8) return;
      vis.push({
        y: Math.round(r.top + window.scrollY),
        h: Math.round(r.height),
        tag: el.tagName,
        texto: (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 46),
        fundo: getComputedStyle(el).backgroundImage.slice(0, 60),
      });
    });
    return vis;
  });
  return { png, arvore };
}

const a = await tira(`http://localhost:${pRef}/${pagina.pasta}/${bp.nome}.html`);
const b = await tira(`http://localhost:${pNovo}${pagina.rota}`);

const ma = await sharp(a.png).metadata(), mb = await sharp(b.png).metadata();
const W = Math.min(ma.width, mb.width), H = Math.min(ma.height, mb.height);
const ra = await sharp(a.png).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();
const rb = await sharp(b.png).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();

const porLinha = new Array(H).fill(0);
for (let y = 0; y < H; y++) {
  const base = y * W * 3;
  for (let x = 0; x < W; x++) {
    const i = base + x * 3;
    if (Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]) > 30) porLinha[y]++;
  }
}

const bandas = [];
let ini = null;
for (let y = 0; y <= H; y++) {
  const forte = porLinha[y] > W * 0.02;
  if (forte && ini === null) ini = y;
  if (!forte && ini !== null) { if (y - ini > 4) bandas.push([ini, y]); ini = null; }
}

const total = porLinha.reduce((s, n) => s + n, 0) / (W * H) * 100;
console.log(`${pagina.rota} @${bp.nome} ${bp.largura}px — ${total.toFixed(2)}% divergente`);
console.log(`altura ref ${ma.height}, nova ${mb.height} — ${bandas.length} banda(s):\n`);

const dentro = (arv, y0, y1) =>
  arv.filter((e) => e.y < y1 && e.y + e.h > y0 && (e.texto || e.fundo !== 'none'))
     .slice(-4)
     .map((e) => `${e.tag} y${e.y} h${e.h} ${e.texto ? `"${e.texto}"` : `bg:${e.fundo}`}`);

for (const [y0, y1] of bandas.slice(0, 14)) {
  const pico = Math.max(...porLinha.slice(y0, y1));
  console.log(`  y ${y0}–${y1} (${y1 - y0}px, pico ${(pico / W * 100).toFixed(0)}% da largura)`);
  console.log(`    ref : ${dentro(a.arvore, y0, y1).join('\n          ') || '—'}`);
  console.log(`    novo: ${dentro(b.arvore, y0, y1).join('\n          ') || '—'}\n`);
}

await nav.close();
encerraServidores();

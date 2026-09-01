#!/usr/bin/env node
/**
 * Compara, pixel a pixel, cada página gerada contra a captura original do
 * Framer no mesmo breakpoint. É o portão de qualidade da migração: se a
 * diferença passar do limite, a página não está fiel.
 *
 *   node tools/verifica-fidelidade.mjs                    # os 3 breakpoints
 *   node tools/verifica-fidelidade.mjs --bp mobile        # um só
 *   node tools/verifica-fidelidade.mjs --limite 0.3
 *
 * A referência é servida sem o runtime do Framer, igual à nossa saída: o que
 * está sendo medido é a fidelidade do DOM estático. As interações que
 * dependiam do runtime são assunto separado — ver seção 6 do HANDOFF.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import { sobe, encerraServidores } from './servidor.mjs';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : padrao;
};
const LIMITE = Number(arg('limite', 0.5));   // % de pixels divergentes tolerada
const ALVO = arg('bp', 'todos');
const SAIDA = '.diffs';
const REF = '.ref';

const alvos = ALVO === 'todos' ? BREAKPOINTS : BREAKPOINTS.filter((b) => b.nome === ALVO);
if (!alvos.length) { console.error(`breakpoint desconhecido: ${ALVO}`); process.exit(1); }

// ── referência sem runtime, espelhando o passo 1 do processador ──
rmSync(REF, { recursive: true, force: true });
for (const { pasta } of PAGINAS) {
  mkdirSync(join(REF, pasta), { recursive: true });
  for (const bp of BREAKPOINTS) {
    const html = readFileSync(join('_capturas', pasta, `${bp.nome}.html`), 'utf8')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script[^>]*\/?>/gi, '');
    writeFileSync(join(REF, pasta, `${bp.nome}.html`), html);
  }
}
mkdirSync(SAIDA, { recursive: true });

const PORTA_REF = await sobe(REF, `/${PAGINAS[0].pasta}/${BREAKPOINTS[0].nome}.html`, 8901);
const PORTA_NOVO = await sobe('public', '/index.html', 8921);
console.log(`referência :${PORTA_REF}   saída :${PORTA_NOVO}`);

async function captura(pagina, url) {
  try {
    await pagina.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  } catch {
    await pagina.goto(url, { waitUntil: 'load', timeout: 45000 });
  }
  await pagina.waitForTimeout(1800);
  await pagina.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 700) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 70));
    }
    window.scrollTo(0, 0);
  });
  await pagina.waitForTimeout(900);
  return pagina.screenshot({ fullPage: true });
}

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const navegador = await chromium.launch();
const resumo = [];

for (const bp of alvos) {
  // Mesmo contexto da captura: o Framer também olha ponteiro e user-agent.
  const ctx = await navegador.newContext({
    viewport: { width: bp.largura, height: bp.altura },
    isMobile: bp.movel,
    hasTouch: bp.movel,
    userAgent: bp.movel ? UA_MOVEL : undefined,
    deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();

  console.log(`\n── ${bp.nome} (${bp.largura}px) ──`);
  const resultados = [];

  for (const { pasta, rota } of PAGINAS) {
    const antes = await captura(p, `http://localhost:${PORTA_REF}/${pasta}/${bp.nome}.html`);
    const depois = await captura(p, `http://localhost:${PORTA_NOVO}${rota}`);

    const ma = await sharp(antes).metadata();
    const mb = await sharp(depois).metadata();
    const W = Math.min(ma.width, mb.width);
    const H = Math.min(ma.height, mb.height);

    const ra = await sharp(antes).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();
    const rb = await sharp(depois).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();

    let divergentes = 0;
    const mapa = Buffer.alloc(W * H * 3, 255);
    for (let i = 0, px = 0; i < ra.length; i += 3, px++) {
      const d = Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]);
      if (d > 30) {
        divergentes++;
        mapa[px * 3] = 255; mapa[px * 3 + 1] = 0; mapa[px * 3 + 2] = 0;
      }
    }
    const pct = (divergentes / (W * H)) * 100;

    if (pct > LIMITE) {
      await sharp(mapa, { raw: { width: W, height: H, channels: 3 } })
        .jpeg({ quality: 70 })
        .toFile(`${SAIDA}/${bp.nome}--${pasta}.jpg`);
    }

    resultados.push({ rota, pct, ok: pct <= LIMITE });
    console.log(
      `${pct <= LIMITE ? '✓' : '✗'} ${rota.padEnd(52)} ${pct.toFixed(2).padStart(6)}%  altura ${ma.height}→${mb.height}`
    );
  }

  const passaram = resultados.filter((r) => r.ok).length;
  console.log(`${passaram}/${resultados.length} dentro do limite de ${LIMITE}%`);
  resumo.push({ bp: bp.nome, passaram, total: resultados.length });
  await ctx.close();
}

await navegador.close();
encerraServidores();

console.log('\n── resumo ──');
for (const r of resumo) console.log(`${r.passaram === r.total ? '✓' : '✗'} ${r.bp.padEnd(8)} ${r.passaram}/${r.total}`);
if (resumo.some((r) => r.passaram !== r.total)) {
  console.log(`\nmapas de diferença (vermelho = divergente) em ${SAIDA}/`);
  process.exitCode = 1;
}

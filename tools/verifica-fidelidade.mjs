#!/usr/bin/env node
/**
 * Compara, pixel a pixel, cada página gerada contra a renderização original
 * do Framer. É o portão de qualidade da migração: se a diferença passar do
 * limite, a página não está fiel.
 *
 *   node tools/verifica-fidelidade.mjs [--largura 1280] [--limite 0.5]
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { ROTAS } from './processa-framer.mjs';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? Number(process.argv[i + 1]) : padrao;
};
const LARGURA = arg('largura', 1280);
const LIMITE = arg('limite', 0.5);   // % de pixels divergentes tolerada
const SAIDA = '.diffs';

mkdirSync(SAIDA, { recursive: true });

const servidores = [
  spawn('python3', ['-m', 'http.server', '8901'], { cwd: '_referencia', stdio: 'ignore' }),
  spawn('python3', ['-m', 'http.server', '8902'], { cwd: 'public', stdio: 'ignore' }),
];
const encerra = () => servidores.forEach((s) => s.kill());
process.on('exit', encerra);
await new Promise((r) => setTimeout(r, 1200));

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

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: LARGURA, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();

const resultados = [];
for (const [arquivo, rota] of Object.entries(ROTAS)) {
  const antes = await captura(p, `http://localhost:8901/renderizado/${encodeURIComponent(arquivo)}`);
  const depois = await captura(p, `http://localhost:8902${rota}`);

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
  const difAltura = ma.height - mb.height;

  if (pct > LIMITE) {
    await sharp(mapa, { raw: { width: W, height: H, channels: 3 } })
      .jpeg({ quality: 70 })
      .toFile(`${SAIDA}/${rota.replace(/\//g, '_') || 'home'}.jpg`);
  }

  resultados.push({ rota, pct, difAltura, ok: pct <= LIMITE });
  const marca = pct <= LIMITE ? '✓' : '✗';
  console.log(
    `${marca} ${rota.padEnd(52)} ${pct.toFixed(2).padStart(6)}%  altura ${ma.height}→${mb.height} (${difAltura >= 0 ? '+' : ''}${-difAltura})`
  );
}

await navegador.close();
encerra();

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} páginas dentro do limite de ${LIMITE}%`);
if (falhas.length) {
  console.log(`mapas de diferença (vermelho = divergente) em ${SAIDA}/`);
  process.exitCode = 1;
}

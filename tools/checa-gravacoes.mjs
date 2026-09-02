#!/usr/bin/env node
/**
 * Portão de saída da Fase 0: "todas as gravações existem e abrem".
 *
 *   node tools/checa-gravacoes.mjs                 # todas
 *   node tools/checa-gravacoes.mjs menu-celular    # só as que casam
 *
 * Abre cada .webm, amostra 4 quadros e mede a diferença entre eles. Vídeo em
 * que nada muda é gravação que não pegou a interação — foi o que aconteceu
 * com as 45 do reveal na primeira rodada, e ninguém teria percebido olhando
 * a lista de arquivos.
 *
 * Não há ffmpeg nesta máquina; quem decodifica é o Chromium, e quem mede é o
 * canvas. Não gasta imagem: a saída é numérica.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
const DIR = new URL('../_capturas/_videos/', import.meta.url).pathname;
const filtro = process.argv[2] ?? '';
const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.webm') && f.includes(filtro)).sort();
const nav = await chromium.launch();
const page = await nav.newPage();
await page.setContent('<video id=v muted></video><canvas id=c></canvas>');
const ruins = [];
for (const f of arquivos) {
  const b64 = readFileSync(join(DIR, f)).toString('base64');
  let r;
  try {
    r = await page.evaluate(async (d) => {
      const v = document.getElementById('v'); v.src = 'data:video/webm;base64,' + d;
      await new Promise((ok, e) => { v.onloadedmetadata = ok; v.onerror = () => e(new Error('não abre')); });
      let dur = v.duration;
      if (!isFinite(dur)) { v.currentTime = 1e6; await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 1500); }); dur = v.currentTime; }
      const c = document.getElementById('c'), cx = c.getContext('2d', { willReadFrequently: true });
      c.width = v.videoWidth; c.height = v.videoHeight;
      let ant = null, difs = [];
      for (let i = 0; i < 4; i++) {
        v.currentTime = (i / 3) * Math.max(0, dur - 0.05);
        await new Promise((ok) => { v.onseeked = ok; setTimeout(ok, 1200); });
        cx.drawImage(v, 0, 0);
        const px = cx.getImageData(0, 0, c.width, c.height).data;
        if (ant) { let s = 0; for (let p = 0; p < px.length; p += 160) s += Math.abs(px[p] - ant[p]); difs.push(Math.round(s / (px.length / 160) * 10) / 10); }
        ant = px;
      }
      return { dur: Math.round(dur * 10) / 10, w: v.videoWidth, h: v.videoHeight, difs };
    }, b64);
  } catch (e) { console.log(`✗ ${f}  ${e.message.slice(0, 40)}`); ruins.push(f); continue; }
  const parado = r.difs.every((d) => d < 1);
  if (parado) ruins.push(f);
  console.log(`${parado ? '⚠' : '✓'} ${f.padEnd(58)} ${String(r.dur).padStart(5)}s ${r.w}×${r.h}  ${r.difs.join(' ')}`);
}
await nav.close();
console.log(`\n${arquivos.length} vídeos · ${ruins.length} parados ou ilegíveis`);
if (ruins.length) ruins.forEach((f) => console.log('  ' + f));

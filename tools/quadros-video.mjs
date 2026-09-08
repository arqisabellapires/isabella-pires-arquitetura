/**
 * Extrai N quadros-chave de um .webm e monta uma tira PNG horizontal.
 *
 * Existe porque não há ffmpeg nesta máquina e olhar vídeo inteiro estoura
 * contexto: um vídeo de 6s a 30fps são 180 imagens, e 4 quadros bastam para
 * ler um zoom, um sticky ou um hover. O Chromium do Playwright decodifica
 * webm, então ele faz o papel do ffmpeg.
 *
 *   node tools/quadros-video.mjs <arquivo.webm> [quantidade] [saida.png]
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { createServer } from 'node:http';
import { createReadStream, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

const arquivo = process.argv[2];
const quantos = Number(process.argv[3] || 4);
const saida = process.argv[4] || join('_capturas/_quadros', basename(arquivo).replace(/\.webm$/, '') + '.png');

if (!arquivo) { console.error('uso: node tools/quadros-video.mjs <arquivo.webm> [n] [saida.png]'); process.exit(1); }

const tamanho = statSync(arquivo).size;
const servidor = createServer((req, res) => {
  const faixa = req.headers.range;
  if (faixa) {
    const m = /bytes=(\d+)-(\d*)/.exec(faixa);
    const ini = +m[1], fim = m[2] ? +m[2] : tamanho - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${ini}-${fim}/${tamanho}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': fim - ini + 1,
      'Content-Type': 'video/webm',
    });
    createReadStream(arquivo, { start: ini, end: fim }).pipe(res);
  } else {
    res.writeHead(200, { 'Content-Length': tamanho, 'Accept-Ranges': 'bytes', 'Content-Type': 'video/webm' });
    createReadStream(arquivo).pipe(res);
  }
});
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const porta = servidor.address().port;

const navegador = await chromium.launch();
const pagina = await navegador.newPage();
await pagina.goto(`http://127.0.0.1:${porta}/pagina`, { waitUntil: 'domcontentloaded' }).catch(() => {});
// setContent espera "load" (= vídeo inteiro); montamos o <video> por script.
await pagina.evaluate((p) => {
  const v = document.createElement('video');
  v.id = 'v'; v.muted = true; v.preload = 'auto';
  v.src = `http://127.0.0.1:${p}/v.webm`;
  document.body.appendChild(v);
}, porta);

const dados = await pagina.evaluate(async (n) => {
  const v = document.getElementById('v');
  const espera = (ev, ms) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout ' + ev)), ms);
    v.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true });
  });
  if (v.readyState < 1) await espera('loadedmetadata', 30000);
  const dur = v.duration;
  const c = document.createElement('canvas');
  c.width = v.videoWidth; c.height = v.videoHeight;
  const ctx = c.getContext('2d');
  const quadros = [];
  for (let i = 0; i < n; i++) {
    // distribui os instantes evitando o primeiro e o último frame exatos
    const t = dur * ((i + 0.5) / n);
    v.currentTime = t;
    await espera('seeked', 20000);
    ctx.drawImage(v, 0, 0);
    quadros.push({ t: Number(t.toFixed(2)), png: c.toDataURL('image/png') });
  }
  return { dur, w: v.videoWidth, h: v.videoHeight, quadros };
}, quantos);

// monta a tira horizontal, com o instante escrito em cada quadro
const tira = await pagina.evaluate(async (d) => {
  const c = document.createElement('canvas');
  const esc = 1;
  c.width = d.w * d.quadros.length * esc;
  c.height = d.h * esc;
  const ctx = c.getContext('2d');
  for (let i = 0; i < d.quadros.length; i++) {
    const img = new Image();
    img.src = d.quadros[i].png;
    await img.decode();
    ctx.drawImage(img, i * d.w * esc, 0, d.w * esc, d.h * esc);
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    ctx.fillRect(i * d.w * esc, 0, 150, 44);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 26px monospace';
    ctx.fillText(d.quadros[i].t + 's', i * d.w * esc + 10, 32);
  }
  return c.toDataURL('image/png');
}, dados);

mkdirSync(dirname(saida), { recursive: true });
writeFileSync(saida, Buffer.from(tira.split(',')[1], 'base64'));
console.log(`${basename(arquivo)}  ${dados.dur.toFixed(2)}s  ${dados.w}×${dados.h}  →  ${saida}`);

await navegador.close();
servidor.close();

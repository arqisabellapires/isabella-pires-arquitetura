#!/usr/bin/env node
/**
 * Portão por seção. Compara uma seção do site novo com a mesma seção da
 * captura do Framer, e diz **em texto** o que está diferente.
 *
 *   node tools/verifica-secao.mjs --pagina home
 *   node tools/verifica-secao.mjs --pagina home --secao hero --bp mobile
 *   node tools/verifica-secao.mjs --pagina home --direita astro
 *
 * O que o verifica-fidelidade faz por página inteira, este faz por seção — e
 * com uma diferença que muda o uso: além do percentual de pixel, ele pareia
 * os elementos das duas seções pelo texto e lista as maiores divergências de
 * medida, do tipo "h1: altura de linha 61.6 vs 67.2". Esse texto é o que se
 * lê para corrigir. O mapa vermelho diz que há erro; a lista diz qual é.
 *
 * O limite de 0,5% aqui SINALIZA, não reprova. Quem reprova é o Gabriel no
 * compara.mjs, olhando. É decisão da spec: a mesma fonte renderiza com
 * hinting diferente e mancha o mapa sem nada estar errado.
 *
 * Precisa de _capturas/<pasta>/secoes.json, que mapeia
 *   id da seção (data-secao no Astro) → data-framer-name ou seletor na captura
 * e é escrito uma vez por página.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import sharp from 'sharp';
import { sobe, encerraServidores } from './servidor.mjs';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';
import { MEDE } from './mede-dom.mjs';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : padrao;
};
const PAGINA = arg('pagina', null);
const SECAO = arg('secao', 'todas');
const ALVO_BP = arg('bp', 'todos');
const DIREITA = arg('direita', 'public');
const ASTRO = arg('astro', 'http://localhost:4321');
const LIMITE = Number(arg('limite', 0.5));
const REF = '.secao-ref';
const SAIDA = '.diffs';

if (!PAGINA) { console.error('use --pagina <pasta>  (ex.: --pagina home)'); process.exit(1); }
const pagina = PAGINAS.find((p) => p.pasta === PAGINA);
if (!pagina) { console.error(`página desconhecida: ${PAGINA}`); process.exit(1); }

const arquivoSecoes = join('_capturas', pagina.pasta, 'secoes.json');
if (!existsSync(arquivoSecoes)) {
  console.error(`falta ${arquivoSecoes}`);
  console.error('É o mapa seção → nome na captura, escrito uma vez por página. Formato:');
  console.error('  { "hero": "Hero Desktop", "servicos": "Frame 3124" }');
  console.error('Os nomes disponíveis saem de medidas.<bp>.json, campo nomeFramer.');
  process.exit(1);
}
const secoes = JSON.parse(readFileSync(arquivoSecoes, 'utf8'));
const ids = Object.keys(secoes).filter((k) => !k.startsWith('_')).filter((k) => SECAO === 'todas' || k === SECAO);
const bps = ALVO_BP === 'todos' ? BREAKPOINTS : BREAKPOINTS.filter((b) => b.nome === ALVO_BP);

// ── referência sem script ──
rmSync(REF, { recursive: true, force: true });
mkdirSync(join(REF, pagina.pasta), { recursive: true });
for (const bp of bps) {
  writeFileSync(join(REF, pagina.pasta, `${bp.nome}.html`),
    readFileSync(join('_capturas', pagina.pasta, `${bp.nome}.html`), 'utf8')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script[^>]*\/?>/gi, ''));
}
mkdirSync(SAIDA, { recursive: true });

const PORTA_REF = await sobe(REF, `/${pagina.pasta}/${bps[0].nome}.html`, 8971);
const PORTA_NOVO = DIREITA === 'astro' ? null : await sobe('public', '/index.html', 8981);

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Um seletor que comece por . ou # é seletor; o resto é data-framer-name. */
const seletorDe = (v) => (/^[.#\[]/.test(v) ? v : `[data-framer-name="${v}"]`);

/** Percentual de pixels divergentes na área comum, mais o mapa. */
async function comparaImagens(a, b, destino) {
  const ma = await sharp(a).metadata(), mb = await sharp(b).metadata();
  const W = Math.min(ma.width, mb.width), H = Math.min(ma.height, mb.height);
  const ra = await sharp(a).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();
  const rb = await sharp(b).extract({ left: 0, top: 0, width: W, height: H }).removeAlpha().raw().toBuffer();
  let divergentes = 0, pior = { y: 0, n: 0 };
  const porLinha = new Array(H).fill(0);
  const mapa = Buffer.alloc(W * H * 3, 255);
  for (let i = 0, px = 0; i < ra.length; i += 3, px++) {
    const d = Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]);
    if (d > 30) {
      divergentes++; porLinha[Math.floor(px / W)]++;
      mapa[px * 3] = 255; mapa[px * 3 + 1] = 0; mapa[px * 3 + 2] = 0;
    }
  }
  // A faixa horizontal com mais divergência é o "onde olhar" mais útil: diz
  // a que altura da seção está o problema.
  porLinha.forEach((n, y) => { if (n > pior.n) pior = { y, n }; });
  const pct = (divergentes / (W * H)) * 100;
  if (pct > LIMITE && destino) {
    await sharp(mapa, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 70 }).toFile(destino);
  }
  return { pct, W, H, dimensoes: { ref: [ma.width, ma.height], novo: [mb.width, mb.height] }, piorFaixa: pior };
}

/** Pareia por texto normalizado e devolve as maiores diferenças de medida. */
function diferencasDeMedida(refs, novos) {
  const chave = (e) => (e.texto ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  const porTexto = new Map();
  for (const e of novos) { const k = chave(e); if (k) (porTexto.get(k) ?? porTexto.set(k, []).get(k)).push(e); }

  const achados = [];
  for (const r of refs) {
    const k = chave(r);
    if (!k) continue;
    const par = porTexto.get(k)?.shift();
    if (!par) { achados.push({ peso: 999, texto: `ausente no novo: "${r.texto.slice(0, 40)}"` }); continue; }
    const comp = (rotulo, a, b, unidade = 'px') => {
      if (a == null || b == null || a === b) return;
      const delta = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) : 1;
      if (typeof a === 'number' && delta < 0.5) return;
      achados.push({ peso: delta, texto: `${(r.texto ?? r.tag).slice(0, 28)} · ${rotulo}: ${a}${unidade} vs ${b}${unidade}` });
    };
    comp('largura', r.caixa.w, par.caixa.w);
    comp('altura', r.caixa.h, par.caixa.h);
    if (r.fonte && par.fonte) {
      comp('tamanho de fonte', r.fonte.tamanho, par.fonte.tamanho);
      comp('peso', r.fonte.peso, par.fonte.peso, '');
      comp('altura de linha', r.fonte.alturaLinha, par.fonte.alturaLinha);
      comp('tracking', r.fonte.tracking, par.fonte.tracking);
      if (r.fonte.familia !== par.fonte.familia) achados.push({ peso: 50, texto: `${(r.texto ?? '').slice(0, 28)} · família: ${r.fonte.familia} vs ${par.fonte.familia}` });
    }
    if (r.cor && par.cor && r.cor !== par.cor) achados.push({ peso: 20, texto: `${(r.texto ?? '').slice(0, 28)} · cor: ${r.cor} vs ${par.cor}` });
  }
  return achados.sort((a, b) => b.peso - a.peso).slice(0, 3).map((a) => a.texto);
}

const navegador = await chromium.launch();
const relatorio = [];

for (const bp of bps) {
  const ctx = await navegador.newContext({
    viewport: { width: bp.largura, height: bp.altura },
    isMobile: bp.movel, hasTouch: bp.movel,
    userAgent: bp.movel ? UA_MOVEL : undefined,
    deviceScaleFactor: 1, reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  console.log(`\n── ${bp.nome} (${bp.largura}px) ──`);

  /** Abre, normaliza o repouso, mede tudo e devolve o handle da seção. */
  const prepara = async (url, seletor) => {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => page.goto(url, { waitUntil: 'load', timeout: 60000 }));
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 100)); }
      scrollTo({ top: 0, behavior: 'instant' });
    });
    const medida = await page.evaluate(MEDE);   // normaliza os reveals de quebra
    // Caixa em coordenadas de documento. boundingBox() do Playwright rola até
    // o elemento antes de medir, e no HTML do Framer — três DOMs empilhados,
    // um por breakpoint — a rolagem não converge e o handle expira. Ler do
    // próprio documento não depende de rolagem nenhuma.
    const caixa = await page.evaluate((sel) => {
      // O HTML da ponte traz os três breakpoints empilhados no mesmo
      // documento: querySelector devolveria o do desktop mesmo medindo em
      // 390px, e ele tem caixa zero. Vale o primeiro com caixa de verdade.
      for (const el of document.querySelectorAll(sel)) {
        const r = el.getBoundingClientRect();
        if (r.width >= 1 && r.height >= 1) {
          return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height };
        }
      }
      return null;
    }, seletor);
    return { caixa, medida, pagina: page };
  };

  /** Print da página inteira, recortado na caixa da seção. */
  const recorta = async (pg, caixa) => {
    const cheia = await pg.screenshot({ fullPage: true });
    const meta = await sharp(cheia).metadata();
    return sharp(cheia).extract({
      left: Math.max(0, Math.round(caixa.x)),
      top: Math.max(0, Math.round(caixa.y)),
      width: Math.min(Math.round(caixa.width), meta.width - Math.max(0, Math.round(caixa.x))),
      height: Math.min(Math.round(caixa.height), meta.height - Math.max(0, Math.round(caixa.y))),
    }).png().toBuffer();
  };

  for (const id of ids) {
    const alvo = secoes[id];
    const seletorRef = seletorDe(typeof alvo === 'string' ? alvo : (alvo[bp.nome] ?? alvo.padrao));

    const ref = await prepara(`http://localhost:${PORTA_REF}/${pagina.pasta}/${bp.nome}.html`, seletorRef);
    if (!ref.caixa) { console.log(`— ${id.padEnd(20)} não achei "${seletorRef}" na captura`); continue; }
    const imgRef = await recorta(ref.pagina, ref.caixa);
    const caixaRef = ref.caixa;

    const urlNovo = DIREITA === 'astro' ? ASTRO + pagina.rota : `http://localhost:${PORTA_NOVO}${pagina.rota}`;
    // Enquanto a página ainda é a ponte (HTML processado do Framer), ela não
    // tem data-secao. Cair no mesmo nome da captura deixa o portão utilizável
    // desde já, e é o que permite comparar seção a seção durante o cutover.
    let novo = await prepara(urlNovo, `[data-secao="${id}"]`);
    let porNome = false;
    if (!novo.caixa && DIREITA === 'public') { novo = await prepara(urlNovo, seletorRef); porNome = true; }
    if (!novo.caixa) { console.log(`— ${id.padEnd(20)} não achei [data-secao="${id}"] no site novo`); continue; }
    const imgNovo = await recorta(novo.pagina, novo.caixa);
    const caixaNovo = novo.caixa;

    const destino = join(SAIDA, `secao--${pagina.pasta}--${id}--${bp.nome}.jpg`);
    const r = await comparaImagens(imgRef, imgNovo, destino);

    const dentro = (m, c) => m.elementos.filter((e) =>
      e.caixa.y >= c.y - 2 && e.caixa.y + e.caixa.h <= c.y + c.height + 2);

    const diffs = diferencasDeMedida(dentro(ref.medida, caixaRef), dentro(novo.medida, caixaNovo));

    const sinal = r.pct <= LIMITE ? '✓' : '⚠';
    console.log(`${sinal} ${id.padEnd(20)} ${r.pct.toFixed(2).padStart(6)}%  ${r.dimensoes.ref.join('×')} → ${r.dimensoes.novo.join('×')}${porNome ? '  (ponte: casado pelo nome do Framer)' : ''}`);
    if (r.pct > LIMITE) console.log(`    pior faixa em y≈${r.piorFaixa.y} da seção (${r.piorFaixa.n} px)`);
    diffs.forEach((d) => console.log(`    · ${d}`));

    relatorio.push({ secao: id, bp: bp.nome, pct: Number(r.pct.toFixed(2)), dimensoes: r.dimensoes, piorFaixa: r.piorFaixa, diferencas: diffs });
  }
  await ctx.close();
}

await navegador.close();
encerraServidores();
rmSync(REF, { recursive: true, force: true });

writeFileSync(join(SAIDA, `secoes--${pagina.pasta}.json`), JSON.stringify({ pagina: pagina.pasta, limite: LIMITE, direita: DIREITA, resultados: relatorio }, null, 1) + '\n');
const sinalizadas = relatorio.filter((r) => r.pct > LIMITE);
console.log(`\n${relatorio.length} comparações · ${sinalizadas.length} acima de ${LIMITE}%`);
console.log(`→ ${SAIDA}/secoes--${pagina.pasta}.json`);
console.log('\nSinalizar não é reprovar: quem aprova é o olho no compara.mjs.');

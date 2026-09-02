#!/usr/bin/env node
/**
 * A captura do Framer vira especificação: mede cada elemento visível e
 * escreve _capturas/<pasta>/medidas.<bp>.json.
 *
 *   node tools/extrai-medidas.mjs                      # 15 páginas × 3 breakpoints
 *   node tools/extrai-medidas.mjs --bp mobile
 *   node tools/extrai-medidas.mjs --pagina home
 *
 * É o passo que faz a reconstrução convergir: nenhum valor de CSS sai da
 * cabeça de ninguém. Quem escreve o componente lê daqui ou de tokens.css,
 * que é derivado daqui.
 *
 * Duas decisões que mudam o resultado, e por quê:
 *
 * 1. Mede a captura crua (_capturas/<pasta>/<bp>.html), não o HTML já
 *    processado em public/. A captura ainda referencia fontes e imagens em
 *    framerusercontent.com — que some junto com a assinatura, em 30/09/2026.
 *    Por isso a saída é versionada: depois de medida e commitada, a
 *    dependência da CDN acaba para sempre.
 *
 * 2. O script do Framer é removido antes de medir, como o verifica-fidelidade
 *    já faz, para o resultado ser determinístico. Só que sem runtime os
 *    elementos com efeito de aparição ficam congelados no estado de partida
 *    (opacity 0, translateX -150) e a caixa deles sai errada. Então, depois
 *    de carregar, o que estiver deslocado ou transparente é normalizado para
 *    o estado de repouso — a mesma leitura que o public/interacoes.js faz
 *    para saber o que animar. Cada elemento normalizado sai marcado com
 *    "revelado": true, para a normalização ser auditável e não silenciosa.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { sobe, encerraServidores } from './servidor.mjs';
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

const arg = (n, padrao) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : padrao;
};
const ALVO_BP = arg('bp', 'todos');
const ALVO_PAGINA = arg('pagina', 'todas');
const SEM_SCRIPT = '.medidas-ref';

const bps = ALVO_BP === 'todos' ? BREAKPOINTS : BREAKPOINTS.filter((b) => b.nome === ALVO_BP);
const paginas = ALVO_PAGINA === 'todas' ? PAGINAS : PAGINAS.filter((p) => p.pasta === ALVO_PAGINA);
if (!bps.length || !paginas.length) { console.error('breakpoint ou página desconhecidos'); process.exit(1); }

// ── cópia sem script, igual ao passo 1 do verifica-fidelidade ──
rmSync(SEM_SCRIPT, { recursive: true, force: true });
for (const { pasta } of paginas) {
  mkdirSync(join(SEM_SCRIPT, pasta), { recursive: true });
  for (const bp of bps) {
    const html = readFileSync(join('_capturas', pasta, `${bp.nome}.html`), 'utf8')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<script[^>]*\/?>/gi, '');
    writeFileSync(join(SEM_SCRIPT, pasta, `${bp.nome}.html`), html);
  }
}

const PORTA = await sobe(SEM_SCRIPT, `/${paginas[0].pasta}/${bps[0].nome}.html`, 8941);
console.log(`capturas sem script em :${PORTA}\n`);

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/**
 * Roda dentro da página. Normaliza o estado de partida dos reveals e mede.
 * Tudo em uma passada só: sair e voltar do contexto por elemento é lento e,
 * pior, deixa o layout mudar entre medidas.
 */
const MEDE = () => {
  const num = (v) => Math.round(parseFloat(v) * 100) / 100 || 0;
  const quatro = (s, p) => [num(s[p + 'Top']), num(s[p + 'Right']), num(s[p + 'Bottom']), num(s[p + 'Left'])];
  const zerado = (a) => a.every((v) => v === 0);

  // ── 1. repouso: desfaz o estado de partida deixado pelo Framer ──
  const revelados = new Set();
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    const m = new DOMMatrixReadOnly(s.transform);
    const deslocado = m.m41 !== 0 || m.m42 !== 0;
    const encolhido = m.a < 1 || m.d < 1;
    if (parseFloat(s.opacity) < 1 || deslocado || encolhido) {
      // Só o que o Framer deixou inline é efeito de aparição; opacidade que
      // vem de folha de estilo é decisão de design e fica como está.
      if (el.style.opacity !== '' || el.style.transform !== '') {
        el.style.opacity = '1';
        el.style.transform = 'none';
        revelados.add(el);
      }
    }
  }

  // ── 2. caminho estável até a raiz ──
  const caminho = (el) => {
    const partes = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
      const tag = e.tagName.toLowerCase();
      const irmaos = e.parentElement ? [...e.parentElement.children].filter((c) => c.tagName === e.tagName) : [e];
      partes.unshift(irmaos.length > 1 ? `${tag}:nth-of-type(${irmaos.indexOf(e) + 1})` : tag);
    }
    return partes.join(' > ');
  };

  // ── 3. medida ──
  const saida = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width * r.height < 4) continue;               // sem caixa útil
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') continue;

    const item = {
      caminho: caminho(el),
      tag: el.tagName.toLowerCase(),
      caixa: { x: num(r.x), y: num(r.y + scrollY), w: num(r.width), h: num(r.height) },
    };

    const nome = el.getAttribute('data-framer-name');
    if (nome) item.nomeFramer = nome;

    // Texto só de quem tem texto próprio: senão todo contêiner repete o
    // texto dos filhos e o arquivo triplica de tamanho sem dizer nada.
    const proprio = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
    if (proprio) item.texto = proprio.replace(/\s+/g, ' ').slice(0, 120);

    // Elemento substituído não tem tipografia própria: <img> com fonte
    // herdada só polui o arquivo.
    const SUBSTITUIDO = ['img', 'svg', 'video', 'canvas', 'iframe', 'br', 'hr', 'source', 'picture'];
    if ((proprio || el.children.length === 0) && !SUBSTITUIDO.includes(item.tag)) {
      item.fonte = {
        familia: s.fontFamily.split(',')[0].replace(/["']/g, ''),
        tamanho: num(s.fontSize),
        peso: Number(s.fontWeight),
        alturaLinha: s.lineHeight === 'normal' ? 'normal' : num(s.lineHeight),
        tracking: s.letterSpacing === 'normal' ? 0 : num(s.letterSpacing),
      };
      item.cor = s.color;
    }

    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)') item.fundo = s.backgroundColor;
    if (s.backgroundImage !== 'none') item.fundoImagem = s.backgroundImage.slice(0, 200);

    const pad = quatro(s, 'padding'); if (!zerado(pad)) item.padding = pad;
    const mar = quatro(s, 'margin'); if (!zerado(mar)) item.margem = mar;
    if (s.display === 'flex' || s.display === 'grid') {
      item.display = s.display;
      item.direcao = s.flexDirection;
      item.alinhamento = [s.justifyContent, s.alignItems];
      if (s.gap !== 'normal' && num(s.gap)) item.gap = num(s.gap);
    }
    if (num(s.borderRadius)) item.raio = s.borderRadius;
    if (s.boxShadow !== 'none') item.sombra = s.boxShadow;
    if (s.borderTopWidth !== '0px') item.borda = `${s.borderTopWidth} ${s.borderTopStyle} ${s.borderTopColor}`;
    if (num(s.opacity) !== 1) item.opacidade = num(s.opacity);
    if (s.position !== 'static') item.posicao = s.position;
    if (s.zIndex !== 'auto') item.z = Number(s.zIndex);
    if (revelados.has(el)) item.revelado = true;

    if (el.tagName === 'IMG') {
      item.imagem = {
        src: el.getAttribute('src'),
        srcset: el.getAttribute('srcset') || undefined,
        sizes: el.getAttribute('sizes') || undefined,
        alt: el.getAttribute('alt') ?? null,
        objectFit: s.objectFit,
        natural: el.naturalWidth ? { w: el.naturalWidth, h: el.naturalHeight } : undefined,
      };
    }

    saida.push(item);
  }
  return { elementos: saida, revelados: revelados.size, altura: document.body.scrollHeight };
};

const navegador = await chromium.launch();
const resumo = [];

for (const bp of bps) {
  const ctx = await navegador.newContext({
    viewport: { width: bp.largura, height: bp.altura },
    isMobile: bp.movel, hasTouch: bp.movel,
    userAgent: bp.movel ? UA_MOVEL : undefined,
    reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  const faltando = [];
  // A sonda do editor (framer.com/edit) sempre falha e não é recurso da
  // página: contá-la faria toda medida nascer com aviso falso.
  const IRRELEVANTE = /framer\.com\/edit|events\.framer\.com/;
  page.on('requestfailed', (r) => { if (!IRRELEVANTE.test(r.url())) faltando.push(r.url().slice(0, 120)); });
  page.on('response', (r) => { if (r.status() >= 400 && !IRRELEVANTE.test(r.url())) faltando.push(`${r.status()} ${r.url().slice(0, 110)}`); });

  for (const pagina of paginas) {
    faltando.length = 0;
    const url = `http://localhost:${PORTA}/${pagina.pasta}/${bp.nome}.html`;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(async () => {
      await page.goto(url, { waitUntil: 'load', timeout: 60000 });
    });
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    // Materializa imagem preguiçosa antes de medir: caixa de <img> sem
    // arquivo carregado mente.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += innerHeight) {
        scrollTo({ top: y, behavior: 'instant' });
        await new Promise((r) => setTimeout(r, 120));
      }
      scrollTo({ top: 0, behavior: 'instant' });
    });
    await page.waitForTimeout(600);

    const { elementos, revelados, altura } = await page.evaluate(MEDE);
    const destino = join('_capturas', pagina.pasta, `medidas.${bp.nome}.json`);
    writeFileSync(destino, JSON.stringify({
      _origem: `_capturas/${pagina.pasta}/${bp.nome}.html`,
      _breakpoint: { nome: bp.nome, largura: bp.largura },
      _rota: pagina.rota,
      _alturaDaPagina: altura,
      _elementosRevelados: revelados,
      _recursosQueFalharam: [...new Set(faltando)],
      elementos,
    }, null, 1) + '\n');

    const kb = (JSON.stringify(elementos).length / 1024).toFixed(0);
    const aviso = faltando.length ? `  ⚠ ${new Set(faltando).size} recursos falharam` : '';
    console.log(`${bp.nome.padEnd(8)} ${pagina.pasta.padEnd(52)} ${String(elementos.length).padStart(4)} el  ${kb.padStart(5)} KB${aviso}`);
    resumo.push({ bp: bp.nome, pagina: pagina.pasta, elementos: elementos.length, falhas: new Set(faltando).size });
  }
  await ctx.close();
}

await navegador.close();
encerraServidores();
rmSync(SEM_SCRIPT, { recursive: true, force: true });

const total = resumo.reduce((s, r) => s + r.elementos, 0);
const comFalha = resumo.filter((r) => r.falhas).length;
console.log(`\n${resumo.length} arquivos · ${total} elementos medidos`);
if (comFalha) console.log(`⚠ ${comFalha} páginas com recurso que não carregou — a medida delas pode estar errada; ver _recursosQueFalharam`);

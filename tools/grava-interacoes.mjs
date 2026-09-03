#!/usr/bin/env node
/**
 * Grava, no Framer vivo, um vídeo de referência de cada ficha de movimento —
 * e mede o que a ficha ainda não sabe.
 *
 *   FRAMER_BASE=https://... node tools/grava-interacoes.mjs
 *   FRAMER_BASE=https://... node tools/grava-interacoes.mjs --ficha=acordeao-servicos
 *   FRAMER_BASE=https://... node tools/grava-interacoes.mjs --bp=mobile --todas
 *
 * Por que existe: a assinatura do Framer vence em 30/09/2026. Depois disso
 * não há mais como ver o site original se mexendo. O verificador
 * (verifica-comportamento.mjs) sabe dizer se a geometria bate; ele não sabe
 * dizer se *parece* igual. Quem responde isso é o Gabriel, olhando o vídeo.
 *
 * O alvo de cada ficha é encontrado pelas classes de variante do componente
 * em _capturas/motion.json — o mesmo caminho que a sonda de presença usou para
 * escrever as fichas. Nada de seletor adivinhado.
 *
 * Saídas:
 *   _capturas/_videos/<pagina>.<bp>.<id>.webm   (fora do git)
 *   _capturas/motion-fichas.json                (campo "medido" preenchido)
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

const BASE = (process.env.FRAMER_BASE ?? '').replace(/\/$/, '');
if (!BASE) {
  console.error('defina FRAMER_BASE (a origem é o Framer, nunca o domínio próprio)');
  process.exit(1);
}

const args = process.argv.slice(2);
const arg = (nome) => args.find((a) => a.startsWith(`--${nome}=`))?.split('=')[1] ?? null;
const soFicha = arg('ficha');
const soBp = arg('bp');
const soPagina = arg('pagina');
const todasAsPaginas = args.includes('--todas');

const CAMINHO_FICHAS = new URL('../_capturas/motion-fichas.json', import.meta.url);
const DIR_VIDEOS = new URL('../_capturas/_videos/', import.meta.url);
mkdirSync(DIR_VIDEOS, { recursive: true });

const arquivo = JSON.parse(readFileSync(CAMINHO_FICHAS, 'utf8'));
const motion = JSON.parse(readFileSync(new URL('../_capturas/motion.json', import.meta.url), 'utf8'));

/** componente (arquivo .js) → classes de variante dele */
const CLASSES_DE = Object.fromEntries(
  motion.map((c) => [c.arquivo, (c.variantes ?? []).map((v) => v.classe).filter(Boolean)]),
);

/**
 * Fichas com paginas: "todas" descrevem cabeçalho e rodapé, que são o mesmo
 * elemento nas 15 páginas. Gravar 15 vezes o mesmo menu não acrescenta nada e
 * custa meia hora. Uma amostra de três famílias de página basta — a menos que
 * se peça --todas. A exceção é o reveal, que é diferente em cada página: a
 * ficha dele não passa por aqui (ver AMOSTRA_REVEAL).
 */
const AMOSTRA = ['home', 'projetos', 'artigos'];
const SEM_AMOSTRA = new Set(['reveal-entrada']);

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const porPasta = Object.fromEntries(PAGINAS.map((p) => [p.pasta, p]));

/** Resolve as páginas de uma ficha em entradas de tools/paginas.mjs. */
function paginasDa(ficha) {
  let pastas;
  if (ficha.paginas === 'todas') {
    pastas = todasAsPaginas || SEM_AMOSTRA.has(ficha.id) ? PAGINAS.map((p) => p.pasta) : AMOSTRA;
  } else {
    pastas = ficha.paginas;
  }
  return pastas.map((p) => porPasta[p]).filter(Boolean).filter((p) => !soPagina || p.pasta === soPagina);
}

/** Abre a página. networkidle trava em /sobre-nós; espera fixa é mais confiável. */
async function abre(page, pagina) {
  const url = `${BASE}${pagina.caminho === '/' ? '/' : encodeURI(pagina.caminho)}`;
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2500);
}

/**
 * Mede o alvo da ficha: o elemento cuja classe é de uma das variantes do
 * componente. Devolve também os candidatos a gatilho — o que dá para clicar
 * ou passar o mouse dentro dele.
 */
const medeAlvo = (classes) => `(() => {
  const set = new Set(${JSON.stringify(classes)});
  let alvo = null;
  for (const el of document.querySelectorAll('[class*="framer-v-"]')) {
    for (const cl of el.classList) if (set.has(cl)) { alvo = el; break; }
    if (alvo) break;
  }
  if (!alvo) return null;
  const r = alvo.getBoundingClientRect();
  const s = getComputedStyle(alvo);
  // Os alvos do Framer são aninhados: um "Frame" e o "Titulo" dentro dele
  // ocupam o mesmo ponto. Clicar nos dois é o mesmo clique e gasta o
  // orçamento de exploração — então desduplica por centro.
  const vistos = new Set();
  const interativos = [...alvo.querySelectorAll('*')]
    // O Framer marca o que é clicável com cursor: pointer. Sem isso o
    // hambúrguer do menu escapa: é um <svg> sem data-framer-name.
    .filter((e) => getComputedStyle(e).cursor === 'pointer' || ['A', 'BUTTON'].includes(e.tagName)
                   || e.getAttribute('role') === 'button')
    .filter((e) => { const b = e.getBoundingClientRect(); return b.width > 8 && b.height > 8; })
    // Controle é pequeno; card é grande. Em ordem de DOM as setas do
    // carrossel vinham depois dos 4 cards e eram cortadas pelo limite.
    .sort((a, b) => { const ba = a.getBoundingClientRect(), bb = b.getBoundingClientRect();
                      return ba.width * ba.height - bb.width * bb.height; })
    .map((e) => { const b = e.getBoundingClientRect(); return {
      tag: e.tagName.toLowerCase(), nome: e.getAttribute('data-framer-name'),
      texto: (e.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 30),
      x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2),
    }; })
    .filter((c) => { const k = Math.round(c.x / 12) + ':' + Math.round(c.y / 12);
      if (vistos.has(k)) return false; vistos.add(k); return true; })
    .slice(0, 10)
    .map((c, i) => ({ i, ...c }));
  return {
    classes: [...alvo.classList].filter((c) => c.startsWith('framer-v-')),
    caixa: { x: Math.round(r.x), y: Math.round(r.y + scrollY), w: Math.round(r.width), h: Math.round(r.height) },
    opacidade: parseFloat(s.opacity), transform: s.transform,
    interativos,
  };
})()`;

/** Rola até o alvo e espera o reveal terminar, para medir o repouso de verdade. */
async function ateOAlvo(page, classes) {
  await page.evaluate((cs) => {
    const set = new Set(cs);
    for (const el of document.querySelectorAll('[class*="framer-v-"]'))
      for (const cl of el.classList)
        if (set.has(cl)) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); return; }
  }, classes);
  await page.waitForTimeout(1500);
}

const ESPERA_MOLA = 1200; // maior mola do site é 0.8 s; 1,2 s cobre com folga

/** Executa o gatilho da ficha e devolve a sequência de medidas. */
async function encena(page, ficha, classes) {
  const passos = [];
  const mede = async (rotulo) => {
    const m = await page.evaluate(medeAlvo(classes));
    passos.push({ rotulo, ...(m ?? { ausente: true }) });
    return m;
  };

  const tipo = ficha.gatilho?.tipo;

  // O reveal não tem componente nem classe: o alvo dele é a página inteira.
  // Este caso vem antes de qualquer medida de alvo, senão a gravação termina
  // sem rolar e o vídeo mostra a página parada — que foi o que aconteceu na
  // primeira rodada, com as 45 gravações de reveal inúteis.
  if (tipo === 'scroll') {
    const altura = await page.evaluate(() => document.body.scrollHeight);
    const passo = Math.round(page.viewportSize().height * 0.5);
    for (let y = 0; y < altura; y += passo) {
      await page.evaluate((v) => scrollTo({ top: v, behavior: 'instant' }), y);
      await page.waitForTimeout(700);
    }
    passos.push({ rotulo: `rolou ${altura}px em passos de ${passo}px` });
    return passos;
  }

  const repouso = await mede('repouso');
  if (!repouso) return passos;

  if (tipo === 'nenhum') {
    // Prova por medida que trocar a classe não muda nada — é o que sustenta
    // a marcação "sem efeito visível" da ficha.
    const de = ficha.de?.classes ?? (ficha.de?.classe ? [ficha.de.classe] : []);
    const para = ficha.para?.classes ?? (ficha.para?.classe ? [ficha.para.classe] : []);
    for (let i = 0; i < para.length; i++) {
      await page.evaluate(([d, p]) => {
        const el = document.querySelector('.' + d);
        if (el) { el.classList.remove(d); el.classList.add(p); }
      }, [de[i], para[i]]);
      await page.waitForTimeout(ESPERA_MOLA);
      await mede(`classe ${de[i]} → ${para[i]}`);
    }
    return passos;
  }

  if (tipo === 'submit') {
    // Nunca submeter de verdade contra o Framer: forçar as variantes de
    // estado pela classe mostra o mesmo desenho sem disparar e-mail deles.
    for (const cl of classes) {
      const trocou = await page.evaluate(([cs, alvoCl]) => {
        const set = new Set(cs);
        for (const el of document.querySelectorAll('[class*="framer-v-"]'))
          for (const c of el.classList)
            if (set.has(c)) { el.classList.remove(c); el.classList.add(alvoCl); return c; }
        return null;
      }, [classes, cl]);
      if (!trocou) continue;
      await page.waitForTimeout(ESPERA_MOLA);
      await mede(`estado ${cl}`);
    }
    return passos;
  }

  // hover, clique e a-descobrir: percorrem os interativos de dentro do alvo.
  const alvos = repouso.interativos ?? [];
  if (tipo === 'hover' || tipo === 'a-descobrir') {
    for (const it of alvos.slice(0, 8)) {
      await page.mouse.move(it.x, it.y);
      await page.waitForTimeout(ESPERA_MOLA);
      await mede(`hover ${it.nome ?? it.tag} "${it.texto}"`);
    }
    await page.mouse.move(2, 2);
    await page.waitForTimeout(ESPERA_MOLA);
    await mede('mouse fora');
  }

  if (tipo === 'clique' || tipo === 'a-descobrir') {
    for (const it of alvos.slice(0, 10)) {
      // Link que navega tira a página do ar e acaba a gravação: pula.
      const navega = await page.evaluate(([x, y]) => {
        const e = document.elementFromPoint(x, y)?.closest('a[href]');
        if (!e) return false;
        const h = e.getAttribute('href') ?? '';
        return !h.startsWith('#') && h !== '';
      }, [it.x, it.y]);
      if (navega) { passos.push({ rotulo: `pulado (link) ${it.texto}`, pulado: true }); continue; }
      await page.mouse.click(it.x, it.y).catch(() => {});
      await page.waitForTimeout(ESPERA_MOLA);
      await mede(`clique ${it.nome ?? it.tag} "${it.texto}"`);
    }
  }

  return passos;
}

const navegador = await chromium.launch();
const relatorio = [];

for (const ficha of arquivo.fichas) {
  if (soFicha && ficha.id !== soFicha) continue;
  if (ficha.estado === 'nao-reproduzir') { console.log(`— ${ficha.id}: marcada nao-reproduzir, pulada`); continue; }

  const componentes = Array.isArray(ficha.componente) ? ficha.componente : [ficha.componente];
  const classes = componentes.flatMap((c) => CLASSES_DE[c] ?? []);
  const bps = BREAKPOINTS.filter((b) => ficha.breakpoints.includes(b.nome)).filter((b) => !soBp || b.nome === soBp);
  ficha.medido ??= {};

  for (const pagina of paginasDa(ficha)) {
    for (const bp of bps) {
      const nome = `${pagina.pasta}.${bp.nome}.${ficha.id}.webm`;
      const ctx = await navegador.newContext({
        viewport: { width: bp.largura, height: bp.altura },
        isMobile: bp.movel, hasTouch: bp.movel,
        userAgent: bp.movel ? UA_MOVEL : undefined,
        recordVideo: { dir: DIR_VIDEOS.pathname, size: { width: bp.largura, height: bp.altura } },
      });
      const page = await ctx.newPage();
      let passos = [];
      try {
        await abre(page, pagina);
        if (classes.length) await ateOAlvo(page, classes);
        passos = await encena(page, ficha, classes);
      } catch (e) {
        passos = [{ rotulo: 'ERRO', erro: e.message.slice(0, 120) }];
      }
      const video = page.video();
      await ctx.close(); // fecha antes de o vídeo existir em disco
      const bruto = video ? await video.path() : null;
      if (bruto && existsSync(bruto)) renameSync(bruto, new URL(nome, DIR_VIDEOS).pathname);

      const mudou = new Set(passos.filter((p) => p.caixa).map((p) => `${p.caixa.w}x${p.caixa.h}`)).size > 1;
      // O carrossel troca a classe da raiz e reordena os filhos por CSS
      // order:. A caixa da raiz nunca muda — medir só geometria dava falso
      // negativo em toda ficha de trocador.
      const trocouVariante = new Set(passos.filter((p) => p.classes).map((p) => (p.classes || []).join(','))).size > 1;
      (ficha.medido[pagina.pasta] ??= {})[bp.nome] = { video: `_capturas/_videos/${nome}`, mudouGeometria: mudou, trocouVariante, passos };
      relatorio.push({ ficha: ficha.id, pagina: pagina.pasta, bp: bp.nome, passos: passos.length, mudou: mudou || trocouVariante });
      const marca = mudou ? '●' : trocouVariante ? '◐' : '○';
      console.log(`${marca} ${nome.padEnd(58)} ${passos.length} passos`);
    }
  }

  const medidas = Object.values(ficha.medido).flatMap((p) => Object.values(p));
  if (medidas.length && ficha.estado === 'a-medir') ficha.estado = 'medida';
}

await navegador.close();
writeFileSync(CAMINHO_FICHAS, JSON.stringify(arquivo, null, 2) + '\n');

const comMovimento = relatorio.filter((r) => r.mudou).length;
console.log(`\n${relatorio.length} gravações · ${comMovimento} com resposta medida (● geometria, ◐ variante) · ${relatorio.length - comMovimento} sem`);
console.log('→ _capturas/_videos/  (fora do git — o backup é item da Fase 0)');
console.log('→ _capturas/motion-fichas.json  (campo "medido")');

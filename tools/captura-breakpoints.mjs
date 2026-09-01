#!/usr/bin/env node
/**
 * Captura o site do Framer ao vivo, já renderizado, nos três breakpoints.
 *
 *   node tools/captura-breakpoints.mjs                  # tudo
 *   node tools/captura-breakpoints.mjs servicos contato # só estas pastas
 *
 * URGENTE enquanto a assinatura do Framer existir: é a única fonte do DOM
 * por breakpoint. Sem isso não há como reproduzir o site no celular.
 * A saída vai para _capturas/<pagina>/<breakpoint>.html
 *
 * A trava de sanidade existe porque já aconteceu: duas páginas foram
 * capturadas do nosso próprio site na Vercel, não do Framer. A captura
 * falsa passa despercebida — o HTML é plausível — e depois vira uma
 * referência que "prova" que a migração está certa comparando-a consigo
 * mesma. Os sinais são a ausência do runtime do Framer e o DOM idêntico
 * entre os três breakpoints.
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

/**
 * Origem das capturas. O domínio próprio já aponta para a Vercel e serve
 * o NOSSO site, então capturar de lá traz a migração de volta como se
 * fosse referência. Use a URL de staging do Framer:
 *
 *   FRAMER_BASE=https://algo.framer.website node tools/captura-breakpoints.mjs
 */
const BASE = (process.env.FRAMER_BASE ?? 'https://www.isabellapiresarquitetura.com.br').replace(/\/$/, '');
console.log(`origem: ${BASE}\n`);
const filtro = process.argv.slice(2);
const alvos = filtro.length ? PAGINAS.filter((p) => filtro.includes(p.pasta)) : PAGINAS;
if (!alvos.length) { console.error(`nenhuma página bate com: ${filtro.join(', ')}`); process.exit(1); }

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

/** Uma página do Framer carrega o runtime dele. A nossa, não. */
const ehDoFramer = (html) => (html.match(/framerusercontent\.com\/sites\//g) ?? []).length >= 5;

const navegador = await chromium.launch();
let ok = 0;
const falhas = [];
const suspeitas = [];

for (const { caminho, pasta } of alvos) {
  mkdirSync(`_capturas/${pasta}`, { recursive: true });
  const capturado = {};

  for (const bp of BREAKPOINTS) {
    const ctx = await navegador.newContext({
      viewport: { width: bp.largura, height: bp.altura },
      isMobile: bp.movel,
      hasTouch: bp.movel,
      userAgent: bp.movel ? UA_MOVEL : undefined,
    });
    const p = await ctx.newPage();
    const url = BASE + caminho.split('/').map(encodeURIComponent).join('/');

    try {
      await p.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await p.waitForTimeout(3000);
      // rola tudo para materializar imagens e conteúdo preguiçoso
      await p.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await p.waitForTimeout(1500);

      const html = '<!DOCTYPE html>\n' + (await p.evaluate(() => document.documentElement.outerHTML));
      const nos = await p.evaluate(() => document.querySelectorAll('*').length);

      if (!ehDoFramer(html)) {
        suspeitas.push(`${pasta}/${bp.nome} — sem o runtime do Framer, não gravado`);
        console.log(`✗ ${pasta}/${bp.nome} — não parece ser o site do Framer, descartada`);
      } else {
        capturado[bp.nome] = html;
        console.log(`✓ ${pasta}/${bp.nome} — ${nos} nós, ${(html.length / 1024).toFixed(0)} KB`);
      }
    } catch (e) {
      console.log(`✗ ${pasta}/${bp.nome} — ${e.message.slice(0, 70)}`);
      falhas.push(`${pasta}/${bp.nome}`);
    }
    await ctx.close();
  }

  // O Framer emite DOM diferente por breakpoint. Três iguais quer dizer que
  // a página capturada é estática — logo, não é a do Framer.
  const tamanhos = Object.values(capturado).map((h) => h.length);
  if (tamanhos.length === 3 && new Set(tamanhos).size === 1) {
    suspeitas.push(`${pasta} — os 3 breakpoints saíram idênticos, não gravado`);
    console.log(`✗ ${pasta} — 3 breakpoints idênticos, descartada`);
    continue;
  }

  for (const [nome, html] of Object.entries(capturado)) {
    writeFileSync(`_capturas/${pasta}/${nome}.html`, html);
    ok++;
  }
}

await navegador.close();
console.log(`\n${ok}/${alvos.length * BREAKPOINTS.length} capturas salvas`);
if (falhas.length) console.log('falhas:', falhas.join(', '));
if (suspeitas.length) {
  console.log(`\n⚠ ${suspeitas.length} captura(s) rejeitadas pela trava de sanidade:`);
  suspeitas.forEach((s) => console.log(`   · ${s}`));
  process.exitCode = 1;
}

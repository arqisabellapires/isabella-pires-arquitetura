#!/usr/bin/env node
/**
 * Captura o site do Framer ao vivo, já renderizado, nos três breakpoints.
 *
 *   node tools/captura-breakpoints.mjs
 *
 * URGENTE enquanto a assinatura do Framer existir: é a única fonte do DOM
 * por breakpoint. Sem isso não há como reproduzir o site no celular.
 * A saída vai para _capturas/<pagina>/<breakpoint>.html
 */
import { chromium } from '/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'https://www.isabellapiresarquitetura.com.br';

/** caminho no Framer → pasta local */
export const PAGINAS = {
  '/': 'home',
  '/sobre-nós': 'sobre-nos',
  '/serviços': 'servicos',
  '/contato': 'contato',
  '/projetos': 'projetos',
  '/projetos/casa-ip': 'projetos__casa-ip',
  '/projetos/ap-mm': 'projetos__ap-mm',
  '/projetos/studio': 'projetos__studio',
  '/artigos/blog': 'artigos',
  '/artigos/vale-mais-a-pena-reformar-ou-construir': 'artigos__vale-mais-a-pena-reformar-ou-construir',
  '/artigos/organize-sua-casa-com-olhar-de-arquiteto': 'artigos__organize-sua-casa-com-olhar-de-arquiteto',
  '/artigos/o-que-muda-na-arquitetura-residencial-em-2026': 'artigos__o-que-muda-na-arquitetura-residencial-em-2026',
  '/artigos/iluminação-decorativa-x-iluminação-funcional': 'artigos__iluminacao-decorativa-x-iluminacao-funcional',
  '/artigos/minimalismo-vs.-maximalismo-qual-estilo-combina-com-você':
    'artigos__minimalismo-vs-maximalismo-qual-estilo-combina-com-voce',
};

const BPS = [
  { nome: 'desktop', w: 1440, h: 900, mobile: false },
  { nome: 'tablet', w: 1000, h: 1000, mobile: false },
  { nome: 'mobile', w: 390, h: 844, mobile: true },
];

const UA_MOVEL =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

const navegador = await chromium.launch();
let ok = 0;
const falhas = [];

for (const [caminho, pasta] of Object.entries(PAGINAS)) {
  mkdirSync(`_capturas/${pasta}`, { recursive: true });

  for (const bp of BPS) {
    const ctx = await navegador.newContext({
      viewport: { width: bp.w, height: bp.h },
      isMobile: bp.mobile,
      hasTouch: bp.mobile,
      userAgent: bp.mobile ? UA_MOVEL : undefined,
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

      const html = await p.evaluate(() => document.documentElement.outerHTML);
      const nos = await p.evaluate(() => document.querySelectorAll('*').length);
      writeFileSync(`_capturas/${pasta}/${bp.nome}.html`, '<!DOCTYPE html>\n' + html);
      console.log(`✓ ${pasta}/${bp.nome} — ${nos} nós, ${(html.length / 1024).toFixed(0)} KB`);
      ok++;
    } catch (e) {
      console.log(`✗ ${pasta}/${bp.nome} — ${e.message.slice(0, 70)}`);
      falhas.push(`${pasta}/${bp.nome}`);
    }
    await ctx.close();
  }
}

await navegador.close();
console.log(`\n${ok}/${Object.keys(PAGINAS).length * BPS.length} capturas salvas`);
if (falhas.length) console.log('falhas:', falhas.join(', '));

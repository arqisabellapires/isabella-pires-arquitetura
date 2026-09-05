#!/usr/bin/env node
/**
 * Lê as medidas capturadas do Framer e resume os TAMANHOS de cada página.
 *
 *   node tools/tamanhos-framer.mjs                  # todas as rotas, desktop
 *   node tools/tamanhos-framer.mjs servicos         # só esta
 *   node tools/tamanhos-framer.mjs --bp mobile
 *
 * A divisão de responsabilidade neste projeto, decidida pelo Gabriel:
 * o **Figma manda na forma** (que desenho a seção tem) e o **Framer manda no
 * tamanho** (altura do menu, corpo de texto, tamanho de imagem). Este script
 * serve o segundo lado, para não ficar adivinhando px olhando captura.
 *
 * Sai em texto, não em imagem: comparar número com número é mais barato e
 * mais exato do que comparar duas fotos.
 */
import { readFileSync, existsSync } from 'node:fs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : d; };
const bp = arg('bp', 'desktop');
const pedidas = process.argv.slice(2).filter((a) => !a.startsWith('--') && a !== bp);
const ROTAS = pedidas.length ? pedidas
  : ['home', 'servicos', 'projetos', 'sobre-nos', 'contato', 'artigos'];

/* O texto do rodapé e do menu repete em toda página; some do resumo para o
   que sobrar ser o conteúdo próprio da página. */
const RUIDO = /^(home|serviços|projetos|blog|sobre nós|contato|institucional|informações)$/i;

for (const rota of ROTAS) {
  const arquivo = `_capturas/${rota}/medidas.${bp}.json`;
  if (!existsSync(arquivo)) { console.log(`\n## ${rota} — sem captura em ${arquivo}`); continue; }
  const d = JSON.parse(readFileSync(arquivo, 'utf8'));

  console.log(`\n## ${rota}  (${bp}, ${d._breakpoint.largura}px · página ${d._alturaDaPagina}px)`);

  /* Altura do menu: o <nav> é o primeiro elemento do topo. */
  const nav = d.elementos.find((e) => e.tag === 'nav');
  if (nav) console.log(`menu: ${Math.round(nav.caixa.h)}px de altura`);

  /* Escala de texto: agrupa por tamanho+peso+família e mostra um exemplo.
     É isso que responde "que tamanho tem o corpo de texto aqui". */
  const porEstilo = new Map();
  for (const e of d.elementos) {
    if (!e.fonte?.tamanho || !e.texto) continue;
    const t = e.texto.trim();
    if (!t || RUIDO.test(t)) continue;
    const chave = `${Math.round(parseFloat(e.fonte.tamanho))}px ${e.fonte.peso ?? ''} ${e.fonte.familia ?? ''}`.trim();
    if (!porEstilo.has(chave)) porEstilo.set(chave, { n: 0, exemplo: t });
    const v = porEstilo.get(chave);
    v.n += 1;
    if (t.length > v.exemplo.length && t.length < 70) v.exemplo = t;
  }
  const estilos = [...porEstilo.entries()]
    .sort((a, b) => parseFloat(b[0]) - parseFloat(a[0]));
  console.log('texto:');
  for (const [k, v] of estilos) {
    console.log(`  ${k.padEnd(34)} ×${String(v.n).padStart(3)}  "${v.exemplo.slice(0, 52)}"`);
  }

  /* Imagens de conteúdo, pelas maiores — dá o tamanho de capa, de card e de
     galeria sem precisar abrir a página. */
  const imgs = d.elementos
    .filter((e) => (e.imagem || e.fundoImagem) && e.caixa.w > 80 && e.caixa.h > 80)
    .map((e) => `${Math.round(e.caixa.w)}×${Math.round(e.caixa.h)}${e.raio && e.raio !== '0px' ? ` r${e.raio}` : ''}`);
  const contagem = imgs.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map());
  const lista = [...contagem.entries()]
    .sort((a, b) => parseInt(b[0]) * parseInt(b[0].split('×')[1]) - parseInt(a[0]) * parseInt(a[0].split('×')[1]))
    .slice(0, 8)
    .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k));
  if (lista.length) console.log(`imagens: ${lista.join(' · ')}`);
}

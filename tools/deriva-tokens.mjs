#!/usr/bin/env node
/**
 * Lê todas as medidas e propõe os tokens. Nenhum valor sai da cabeça.
 *
 *   node tools/extrai-medidas.mjs && node tools/deriva-tokens.mjs
 *   node tools/deriva-tokens.mjs --sobrescreve      # grava src/styles/tokens.css
 *
 * Por padrão escreve em src/styles/tokens.derivados.css e não encosta no
 * tokens.css atual, que é da primeira tentativa e tem valor de memória
 * (escalas em clamp, espaçamentos inventados). O da primeira tentativa vale
 * como mapa de NOMES — os nomes são decisão do Gabriel; os valores, não.
 *
 * O relatório em _capturas/tokens-relatorio.json diz, para cada valor, quantas
 * vezes aparece e onde. É por ele que se decide o que é token e o que é
 * exceção de uma seção só.
 *
 * Uma decisão da spec que este script obedece: tipografia sai com UM VALOR
 * POR BREAKPOINT, não clamp(). O original salta entre três valores, e é isso
 * que a captura mostra. Interpolar é redesenhar.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PAGINAS, BREAKPOINTS } from './paginas.mjs';

const SOBRESCREVE = process.argv.includes('--sobrescreve');
const DESTINO = SOBRESCREVE ? 'src/styles/tokens.css' : 'src/styles/tokens.derivados.css';

// ── 1. carrega as medidas ──────────────────────────────────────────────
const medidas = [];
for (const p of PAGINAS) {
  for (const bp of BREAKPOINTS) {
    const f = join('_capturas', p.pasta, `medidas.${bp.nome}.json`);
    if (!existsSync(f)) continue;
    medidas.push({ pagina: p.pasta, bp: bp.nome, dados: JSON.parse(readFileSync(f, 'utf8')) });
  }
}
if (!medidas.length) { console.error('nenhum medidas.*.json — rode tools/extrai-medidas.mjs antes'); process.exit(1); }
console.log(`${medidas.length} arquivos de medida, ${medidas.reduce((s, m) => s + m.dados.elementos.length, 0)} elementos\n`);

/** Contador com procedência: quantas vezes, e em que páginas. */
const cria = () => new Map();
const soma = (mapa, chave, onde, exemplo) => {
  if (chave == null || chave === '') return;
  const e = mapa.get(chave) ?? { n: 0, onde: new Set(), exemplo: null };
  e.n++; e.onde.add(onde); if (!e.exemplo && exemplo) e.exemplo = exemplo;
  mapa.set(chave, e);
};
const ordenado = (mapa, min = 1) => [...mapa.entries()]
  .filter(([, v]) => v.n >= min)
  .sort((a, b) => b[1].n - a[1].n)
  .map(([k, v]) => ({ valor: k, n: v.n, onde: [...v.onde].slice(0, 6), exemplo: v.exemplo }));

const hex = (rgb) => {
  const m = String(rgb).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
  if (!m) return String(rgb);
  const [r, g, b, a] = [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
  const h = '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  return a === 1 ? h : `${h}${Math.round(a * 255).toString(16).padStart(2, '0')}`;
};

// ── 2. agrupa ──────────────────────────────────────────────────────────
const cores = cria(), fundos = cria(), raios = cria(), sombras = cria(), bordas = cria();
const tipo = Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, cria()]));
const gaps = Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, cria()]));
const paddings = Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, cria()]));
const larguras = Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, cria()]));
const familias = cria();

/**
 * Cor e tipografia só contam onde o elemento REALMENTE PINTA TEXTO PRÓPRIO.
 *
 * Sem este corte a contagem vira ficção, por três motivos que se somam e que
 * foram medidos, não supostos:
 *
 * 1. `color` é herdado e o navegador computa um valor para TODO elemento,
 *    inclusive `div` de layout que não desenha letra nenhuma. Era daí que
 *    saía `#0000ee` (314×): o azul de link padrão do navegador, em 6
 *    elementos na home — nenhum deles com texto. Nunca foi decisão de
 *    ninguém, é o valor inicial do UA.
 * 2. `strong`, `span` e `a` dentro de um parágrafo herdam a cor do pai e
 *    votam de novo. Eram 29% dos elementos com texto: um parágrafo com
 *    quatro negritos contava cinco vezes a mesma decisão.
 * 3. Estilo de terceiro entra como se fosse do site: `#6c757d` e `#212529`
 *    são cinzas do Bootstrap, e `Segoe UI` é degrau de pilha de fallback.
 *    Continuam aparecendo, mas agora com frequência honesta, e o relatório
 *    mostra em que página estão — que é como se decide se é token ou
 *    sujeira de widget.
 *
 * Caixa, espaçamento e forma continuam contando em todo elemento: ali o
 * elemento sem texto é exatamente o que interessa (contêiner, moldura).
 */
const TAGS_INLINE = new Set(['strong', 'em', 'b', 'i', 'span', 'a', 'u', 'small', 'code', 'sup', 'sub', 'mark']);
const pintaTextoProprio = (el) => Boolean(el.texto && el.texto.trim()) && !TAGS_INLINE.has(el.tag);

for (const { pagina, bp, dados } of medidas) {
  for (const el of dados.elementos) {
    const comTexto = pintaTextoProprio(el);
    if (el.cor && comTexto) soma(cores, hex(el.cor), pagina, el.texto);
    if (el.fundo) soma(fundos, hex(el.fundo), pagina, el.nomeFramer ?? el.tag);
    if (el.raio) soma(raios, el.raio, pagina);
    if (el.sombra) soma(sombras, el.sombra, pagina);
    if (el.borda) soma(bordas, el.borda, pagina);
    if (el.fonte && comTexto) {
      soma(familias, el.fonte.familia, pagina);
      // A chave é o conjunto que define um estilo de texto. Duas linhas com
      // o mesmo tamanho e pesos diferentes são dois tokens, não um.
      const chave = [el.fonte.familia, el.fonte.tamanho, el.fonte.peso, el.fonte.alturaLinha, el.fonte.tracking].join('|');
      soma(tipo[bp], chave, pagina, el.texto);
    }
    if (el.gap) soma(gaps[bp], el.gap, pagina);
    if (el.padding) for (const v of el.padding) if (v) soma(paddings[bp], v, pagina);
    // Largura de contêiner: só o que se repete muito é contêiner; o resto é
    // conteúdo. O corte por frequência acontece na hora de escrever.
    if (el.caixa.w >= 200) soma(larguras[bp], Math.round(el.caixa.w), pagina);
  }
}

// ── 3. molas, do fonte do Framer ───────────────────────────────────────
/**
 * A mesma curva do public/interacoes.js: oscilador harmônico amortecido.
 *
 * O ramo `zeta >= 1` não é preciosismo: sem ele, mola sem repique vira
 * `linear(NaN, NaN, …)`, que é CSS inválido — o navegador descarta a
 * declaração inteira e a animação volta calada para o default. Foram 4 das
 * 10 molas do Framer, todas com bounce 0.
 *
 * Por que dá NaN: em bounce 0 o amortecimento é crítico (zeta = 1), então
 * `omegaD = omega·sqrt(1 − zeta²)` é zero e a fórmula subamortecida divide
 * por ele. A solução do caso crítico não tem seno nem cosseno — é
 * `1 − e^(−ωt)(1 + ωt)`, que é o limite da outra quando zeta → 1.
 */
function curvaDeMola(duracao, bounce, quadros = 24) {
  const zeta = Math.max(0.05, 1 - bounce);
  const omega = 5 / (zeta * duracao);
  const omegaD = omega * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  const v = [];
  for (let i = 0; i < quadros; i++) {
    const t = (i / (quadros - 1)) * duracao;
    const d = Math.exp(-zeta * omega * t);
    v.push(omegaD > 0
      ? 1 - d * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t))
      : 1 - d * (1 + omega * t));
  }
  v[v.length - 1] = 1;
  return v;
}
/** spring damping/stiffness/mass → o par (bounce, duração) que o CSS entende. */
function deFisica({ damping, stiffness, mass = 1 }) {
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const omega = Math.sqrt(stiffness / mass);
  return { bounce: Math.max(0, 1 - zeta), duracao: Math.round((5 / (zeta * omega)) * 100) / 100 };
}
const linear = (duracao, bounce) =>
  `linear(${curvaDeMola(duracao, bounce).map((v) => Math.round(v * 10000) / 10000).join(', ')})`;

const motion = JSON.parse(readFileSync('_capturas/motion.json', 'utf8'));
const molas = new Map();
for (const comp of motion) {
  for (const t of comp.transicoes ?? []) {
    if (t.type !== 'spring') continue;
    const { bounce, duracao } = t.stiffness
      ? deFisica({ damping: Number(t.damping), stiffness: Number(t.stiffness), mass: Number(t.mass ?? 1) })
      : { bounce: Number(t.bounce ?? 0), duracao: Number(t.duration ?? 0.4) };
    const chave = `${bounce.toFixed(2)}|${duracao.toFixed(2)}`;
    const e = molas.get(chave) ?? { bounce, duracao, onde: new Set() };
    e.onde.add(comp.arquivo);
    molas.set(chave, e);
  }
}

// ── 4. escreve ─────────────────────────────────────────────────────────
const bloco = (titulo) => `\n  /* ${'─'.repeat(3)} ${titulo} ${'─'.repeat(Math.max(3, 54 - titulo.length))} */\n`;
const L = [];
L.push('/* ============================================================');
L.push('   Tokens derivados — gerado por tools/deriva-tokens.mjs');
// O glob não pode ser escrito literal: "_capturas/*/medidas" contém `*/`,
// que FECHA o comentário CSS na terceira linha do arquivo. O resto do
// cabeçalho vira lixo sintático e leva o bloco :root inteiro junto — o
// navegador descartava as 517 custom properties e sobrava só o @media.
// Aqui a barra é separada do asterisco por um espaço.
L.push(`   Origem: ${medidas.length} arquivos _capturas/<pagina>/medidas.<bp>.json`);
L.push('');
L.push('   EDITE OS NOMES, NÃO OS VALORES. Todo valor aqui foi medido na');
L.push('   captura do Framer. Trocar um valor à mão é reintroduzir memória');
L.push('   no lugar de medida — que é exatamente o que fez a primeira');
L.push('   tentativa de reconstrução divergir em 14 pontos.');
L.push('');
L.push('   Procedência de cada valor (quantas vezes, em que páginas):');
L.push('   _capturas/tokens-relatorio.json');
L.push('   ============================================================ */');
L.push('');
L.push(':root {');

L.push(bloco('Cor: texto'));
ordenado(cores, 2).forEach((c, i) => L.push(`  --cor-texto-${i + 1}: ${c.valor};  /* ${c.n}× · ex.: ${(c.exemplo ?? '').slice(0, 34)} */`));
L.push(bloco('Cor: fundo'));
ordenado(fundos, 2).forEach((c, i) => L.push(`  --cor-fundo-${i + 1}: ${c.valor};  /* ${c.n}× · ${c.onde.slice(0, 3).join(', ')} */`));

L.push(bloco('Famílias'));
ordenado(familias).forEach((f, i) => L.push(`  --fonte-${i + 1}: '${f.valor}';  /* ${f.n}× */`));

for (const bp of BREAKPOINTS) {
  const escala = ordenado(tipo[bp.nome], 3)
    .map((t) => { const [familia, tamanho, peso, altura, tracking] = t.valor.split('|'); return { ...t, familia, tamanho: Number(tamanho), peso, altura, tracking }; })
    .sort((a, b) => b.tamanho - a.tamanho);
  L.push(bloco(`Tipografia · ${bp.nome} (≥${bp.largura}px)`));
  escala.forEach((t, i) => {
    L.push(`  --texto-${bp.nome}-${i + 1}: ${t.tamanho}px/${t.altura === 'normal' ? 'normal' : t.altura + 'px'} ${t.peso} '${t.familia}';`);
    L.push(`  --tracking-${bp.nome}-${i + 1}: ${t.tracking}px;  /* ${t.n}× · ex.: ${(t.exemplo ?? '').slice(0, 30)} */`);
  });
}

for (const bp of BREAKPOINTS) {
  L.push(bloco(`Espaçamento · ${bp.nome}`));
  const g = ordenado(gaps[bp.nome], 3).map((x) => Number(x.valor)).sort((a, b) => a - b);
  const p = ordenado(paddings[bp.nome], 5).map((x) => Number(x.valor)).sort((a, b) => a - b);
  const todos = [...new Set([...g, ...p])].sort((a, b) => a - b);
  todos.forEach((v, i) => {
    const quantiza = v % 4 === 0;
    L.push(`  --esp-${bp.nome}-${i + 1}: ${v}px;${quantiza ? '' : '  /* não é múltiplo de 4 — valor literal do Framer */'}`);
  });
  const larg = ordenado(larguras[bp.nome], 8).slice(0, 8).map((x) => Number(x.valor));
  larg.forEach((v, i) => L.push(`  --largura-${bp.nome}-${i + 1}: ${v}px;`));
}

L.push(bloco('Forma'));
ordenado(raios, 2).forEach((r, i) => L.push(`  --raio-${i + 1}: ${r.valor};  /* ${r.n}× */`));
ordenado(sombras, 2).forEach((s, i) => L.push(`  --sombra-${i + 1}: ${s.valor};  /* ${s.n}× */`));
ordenado(bordas, 2).forEach((b, i) => L.push(`  --borda-${i + 1}: ${b.valor};  /* ${b.n}× */`));

L.push(bloco('Movimento — molas do Framer, em linear() de verdade'));
L.push('  /* cubic-bezier não expressa mola com mais de um repique; linear() sim.');
L.push('     Cobertura ~87%; onde faltar, o fallback é ease-out. */');
[...molas.values()].sort((a, b) => a.duracao - b.duracao).forEach((m, i) => {
  L.push(`  --mola-${i + 1}-duracao: ${m.duracao}s;  /* bounce ${m.bounce.toFixed(2)} · ${[...m.onde].slice(0, 3).join(' ')} */`);
  L.push(`  --mola-${i + 1}: ${linear(m.duracao, m.bounce)};`);
});

L.push('}');
L.push('');
L.push('@media (prefers-reduced-motion: reduce) {');
L.push('  :root {');
[...molas.values()].forEach((_, i) => L.push(`    --mola-${i + 1}-duracao: 1ms;`));
L.push('  }');
L.push('}');

writeFileSync(DESTINO, L.join('\n') + '\n');

const relatorio = {
  _gerado: 'tools/deriva-tokens.mjs',
  _arquivosDeMedida: medidas.length,
  cores: ordenado(cores), fundos: ordenado(fundos),
  familias: ordenado(familias),
  tipografia: Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, ordenado(tipo[b.nome], 2)])),
  gaps: Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, ordenado(gaps[b.nome], 2)])),
  paddings: Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, ordenado(paddings[b.nome], 3)])),
  larguras: Object.fromEntries(BREAKPOINTS.map((b) => [b.nome, ordenado(larguras[b.nome], 5).slice(0, 20)])),
  raios: ordenado(raios), sombras: ordenado(sombras), bordas: ordenado(bordas),
  molas: [...molas.values()].map((m) => ({ bounce: m.bounce, duracao: m.duracao, onde: [...m.onde] })),
};
writeFileSync('_capturas/tokens-relatorio.json', JSON.stringify(relatorio, null, 1) + '\n');

console.log(`cores de texto: ${ordenado(cores, 2).length}   fundos: ${ordenado(fundos, 2).length}   famílias: ${familias.size}`);
for (const bp of BREAKPOINTS) console.log(`tipografia ${bp.nome.padEnd(8)} ${ordenado(tipo[bp.nome], 3).length} estilos`);
console.log(`molas: ${molas.size}   raios: ${ordenado(raios, 2).length}   sombras: ${ordenado(sombras, 2).length}`);
console.log(`\n→ ${DESTINO}`);
console.log('→ _capturas/tokens-relatorio.json');
if (!SOBRESCREVE) console.log('\n(tokens.css atual intacto — passe --sobrescreve quando os nomes estiverem decididos)');

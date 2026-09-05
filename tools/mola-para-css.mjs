#!/usr/bin/env node
/**
 * Converte as molas das fichas de motion em `linear()` do CSS.
 *
 *   node tools/mola-para-css.mjs            # imprime o CSS
 *   node tools/mola-para-css.mjs --escreve  # grava src/styles/motion.css
 *
 * As 17 interações do Framer foram medidas no site vivo antes de a
 * assinatura vencer (_capturas/motion-fichas.json), e cada uma trouxe a
 * física da sua mola: damping/mass/stiffness, ou bounce/duração. Isto
 * transforma essa física em curva que o navegador entende nativamente, sem
 * biblioteca: `linear()` aceita uma lista de pontos, e uma mola amostrada
 * em pontos suficientes é indistinguível da mola de verdade.
 *
 * Por que não usar a biblioteca `motion`, que está instalada: porque ela
 * custa JavaScript em toda página para reproduzir uma curva que o CSS já
 * sabe fazer. As duas bibliotecas paradas no package.json saem.
 *
 * A matemática é a do oscilador harmônico amortecido, que é o que Framer
 * Motion resolve por baixo:
 *
 *   ζ = c / (2·√(k·m))        razão de amortecimento
 *   ω = √(k/m)                frequência natural
 *
 * Subamortecido (ζ<1) oscila e é o caso que "quica". Crítico (ζ=1) e
 * superamortecido (ζ>1) chegam sem passar do ponto — e o ζ=1 exige fórmula
 * própria, senão vira divisão por zero. Esse NaN já apareceu antes neste
 * projeto, em 4 das 10 molas do deriva-tokens; aqui ele é tratado.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const PONTOS = 24;

/** bounce (Framer) → razão de amortecimento. bounce 0 é crítico. */
const bounceParaZeta = (bounce) => 1 - Math.max(0, Math.min(0.9, bounce ?? 0));

function amostra(mola) {
  let zeta, omega, duracao;

  if (mola.stiffness != null) {
    const m = mola.mass ?? 1;
    omega = Math.sqrt(mola.stiffness / m);
    zeta = (mola.damping ?? 0) / (2 * Math.sqrt(mola.stiffness * m));
    /* Duração até assentar em 1%: -ln(0.01)/(ζ·ω), limitada ao razoável. */
    duracao = Math.min(2, Math.max(0.15, 4.6 / Math.max(0.05, zeta * omega)));
  } else {
    duracao = mola.duracao ?? 0.4;
    zeta = bounceParaZeta(mola.bounce);
    omega = 4.6 / (Math.max(0.05, zeta) * duracao);
  }

  const y = [];
  for (let i = 0; i <= PONTOS; i++) {
    const t = (i / PONTOS) * duracao;
    let v;
    if (zeta < 1) {
      const wd = omega * Math.sqrt(1 - zeta * zeta);
      v = 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + ((zeta * omega) / wd) * Math.sin(wd * t));
    } else if (zeta === 1) {
      v = 1 - Math.exp(-omega * t) * (1 + omega * t);   /* crítico: sem divisão por zero */
    } else {
      const r = omega * Math.sqrt(zeta * zeta - 1);
      const a = -zeta * omega + r, b = -zeta * omega - r;
      v = 1 - (b * Math.exp(a * t) - a * Math.exp(b * t)) / (b - a);
    }
    y.push(Number(v.toFixed(4)));
  }
  y[y.length - 1] = 1;   /* termina exatamente no destino */
  return { pontos: y, duracao: Number(duracao.toFixed(3)) };
}

const fichas = JSON.parse(readFileSync('_capturas/motion-fichas.json', 'utf8')).fichas;
const linhas = [];

for (const f of fichas) {
  if (!f.mola) continue;
  const { pontos, duracao } = amostra(f.mola);
  if (pontos.some((p) => !Number.isFinite(p))) {
    console.error(`✗ ${f.id}: a curva saiu com NaN`);
    process.exitCode = 1;
    continue;
  }
  linhas.push(`  /* ${f.titulo ?? f.id} */`);
  linhas.push(`  --mola-${f.id}: linear(${pontos.join(', ')});`);
  linhas.push(`  --dur-${f.id}: ${duracao}s;`);
}

const css = `/* ============================================================
   Movimento — gerado por tools/mola-para-css.mjs

   NÃO EDITE À MÃO. Cada curva é a mola que o Framer usava de verdade,
   medida no site vivo e guardada em _capturas/motion-fichas.json.

   Regerar:  node tools/mola-para-css.mjs --escreve
   ============================================================ */

:root {
${linhas.join('\n')}
}

/* Quem pediu menos movimento, recebe menos movimento. */
@media (prefers-reduced-motion: reduce) {
  :root {
${fichas.filter((f) => f.mola).map((f) => `    --dur-${f.id}: 1ms;`).join('\n')}
  }
}
`;

if (process.argv.includes('--escreve')) {
  writeFileSync('src/styles/motion.css', css);
  console.log(`✓ src/styles/motion.css — ${linhas.length / 3} molas`);
} else {
  console.log(css);
}

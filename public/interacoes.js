/**
 * Interações do site, reescritas.
 *
 * O Framer entregava isso pelo runtime dele, que a migração remove. O que
 * está aqui é implementação própria: só os valores de movimento vieram da
 * dissecação do site original, porque são fatos do design.
 *
 *   scroll reveals — opacity 0 → 1, translateX(-150px) → 0
 *                    mola: bounce 0,2 / duração 0,8s
 *
 * Ainda faltam carrossel de projetos, acordeão de serviços e menu de
 * celular. Os três dependem de injetar conteúdo que o Framer buscava do
 * CMS e que não está no DOM — ver seção 6 do HANDOFF.
 */
(() => {
  'use strict';

  const DURACAO = 0.8;   // segundos
  const BOUNCE = 0.2;    // 0 = sem oscilação; vira razão de amortecimento

  /**
   * Curva de mola por oscilador harmônico amortecido.
   * Devolve N valores de 0 a 1, o último exatamente 1.
   */
  function curvaDeMola(duracao, bounce, quadros = 60) {
    const zeta = Math.max(0.05, 1 - bounce);          // razão de amortecimento
    const omega = 5 / (zeta * duracao);               // acomoda dentro da duração
    const omegaD = omega * Math.sqrt(1 - zeta * zeta); // frequência amortecida
    const v = [];
    for (let i = 0; i < quadros; i++) {
      const t = (i / (quadros - 1)) * duracao;
      const decaimento = Math.exp(-zeta * omega * t);
      v.push(1 - decaimento * (Math.cos(omegaD * t) + (zeta * omega / omegaD) * Math.sin(omegaD * t)));
    }
    v[v.length - 1] = 1;
    return v;
  }

  /** A árvore de breakpoint que está de fato no layout. */
  const arvoreAtiva = () =>
    [...document.querySelectorAll('[data-bp]')].find((d) => getComputedStyle(d).display !== 'none')
    ?? document.body;

  /**
   * Elementos que o Framer deixou esperando o reveal.
   *
   * Dois casos. O comum é opacity 0 com translateX(-150px). O outro é
   * elemento congelado no meio da animação — a captura pegou o site com
   * o reveal já rodando, e sobrou opacity 0,5 com scale 0,9.
   *
   * O que NÃO é reveal: scale acima de 1, que é zoom de imagem no hover.
   * Confundir os dois faria a imagem de /servicos/ saltar sozinha.
   */
  function candidatos() {
    return [...arvoreAtiva().querySelectorAll('*')].filter((el) => {
      const s = getComputedStyle(el);
      const opacidade = parseFloat(s.opacity);
      if (!(opacidade < 1)) return false;

      const r = el.getBoundingClientRect();
      if (r.height < 20 || r.width < 20) return false;

      if (opacidade === 0) return true;

      const m = new DOMMatrixReadOnly(s.transform);
      const deslocado = m.m41 !== 0 || m.m42 !== 0;
      const encolhido = m.a < 1 || m.d < 1;
      return deslocado || encolhido;
    });
  }

  function revela(el, inicio) {
    const valores = curvaDeMola(DURACAO, BOUNCE);
    const opacidadeInicial = inicio.opacidade;
    el.animate(
      valores.map((v, i) => {
        const avanco = Math.min(1, i / (valores.length * 0.35));
        const escala = inicio.escala + (1 - inicio.escala) * v;
        return {
          opacity: String(opacidadeInicial + (1 - opacidadeInicial) * avanco),
          transform: `translate(${(inicio.x * (1 - v)).toFixed(2)}px, ${(inicio.y * (1 - v)).toFixed(2)}px) scale(${escala.toFixed(4)})`,
        };
      }),
      { duration: DURACAO * 1000, easing: 'linear', fill: 'forwards' },
    );
  }

  function inicia() {
    const alvos = candidatos();
    if (!alvos.length) return;

    // Sem animação para quem pediu menos movimento: mostra e pronto.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      alvos.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
      return;
    }

    // Estado de partida, lido do que o Framer deixou posto no elemento.
    const partida = new Map();
    for (const el of alvos) {
      const s = getComputedStyle(el);
      const m = new DOMMatrixReadOnly(s.transform);
      partida.set(el, { x: m.m41 || 0, y: m.m42 || 0, escala: m.a || 1, opacidade: parseFloat(s.opacity) || 0 });
    }

    const observador = new IntersectionObserver((entradas) => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        revela(e.target, partida.get(e.target));
        observador.unobserve(e.target);
      }
    }, { threshold: 0.01 });

    alvos.forEach((el) => observador.observe(el));

    // Rede de segurança: elemento que nunca chega a cruzar o limiar — o
    // último da página, com o rodapé logo abaixo — apareceria nunca.
    window.addEventListener('scroll', function ultimoRecurso() {
      if (window.scrollY + window.innerHeight < document.body.scrollHeight - 40) return;
      window.removeEventListener('scroll', ultimoRecurso);
      for (const el of alvos) {
        if (parseFloat(getComputedStyle(el).opacity) < 1) { revela(el, partida.get(el)); observador.unobserve(el); }
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inicia);
  else inicia();

  // A troca de breakpoint põe outra árvore no layout, com os próprios ocultos.
  let redimensionando;
  window.addEventListener('resize', () => {
    clearTimeout(redimensionando);
    redimensionando = setTimeout(inicia, 250);
  });
})();

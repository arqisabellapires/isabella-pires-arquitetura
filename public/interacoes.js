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


  // ─────────────────────────────────────────────────────────────────
  //  Variantes: hover de card e menu de celular
  //
  //  Cada componente do Framer é uma máquina de estado, e o CSS de TODAS
  //  as variantes vem servido na página — inclusive das que o HTML não
  //  usa. São os estados de hover e aberto, esperando alguém aplicar.
  //
  //  public/variantes.json diz qual classe é o repouso e qual é a
  //  resposta. A tabela sai de tools/extrai-variantes.mjs, que lê os
  //  nomes que a designer deu no Framer ("Casa IP Desktop - Hover").
  //
  //  Nem todo par funciona: os do acordeão trocam de classe sem mudar
  //  nada, porque o conteúdo do painel aberto não está no DOM. Ficam
  //  registrados no JSON e são ignorados aqui por não terem efeito.
  // ─────────────────────────────────────────────────────────────────

  const MOLA_CSS = 'cubic-bezier(.34, 1.2, .64, 1)';   // ≈ spring bounce .2

  /**
   * Um par só serve se trocar a classe mudar alguma coisa na tela. Vários
   * não mudam — o painel aberto do acordeão não tem conteúdo no DOM, e o
   * cabeçalho tem par de Open/Closed que não altera geometria. Aplicar
   * handler neles seria pior que inútil: o de clique chamaria
   * preventDefault e mataria a navegação do site inteiro.
   */
  function temEfeito(el, par) {
    const medir = () => { const b = el.getBoundingClientRect(); const s = getComputedStyle(el);
      return `${Math.round(b.width)}x${Math.round(b.height)}|${s.opacity}|${s.transform}|${s.backgroundColor}`; };
    const antes = medir();
    el.classList.remove(par.de); el.classList.add(par.para);
    const depois = medir();
    el.classList.remove(par.para); el.classList.add(par.de);
    return antes !== depois;
  }

  function aplicaVariantes(pares) {
    const raiz = arvoreAtiva();
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let ligados = 0;

    for (const par of pares) {
      for (const el of raiz.querySelectorAll('.' + par.de)) {
        if (el.dataset.variantePronta) continue;
        if (!temEfeito(el, par)) continue;
        el.dataset.variantePronta = '1';
        ligados++;

        if (!reduzido) {
          el.style.transition =
            `height .4s ${MOLA_CSS}, width .4s ${MOLA_CSS}, transform .4s ${MOLA_CSS}, opacity .3s ease`;
        }

        const troca = (ligado) => {
          el.classList.toggle(par.de, !ligado);
          el.classList.toggle(par.para, ligado);
          el.dataset.varianteAtiva = ligado ? '1' : '';
        };

        if (par.gatilho === 'hover') {
          el.addEventListener('mouseenter', () => troca(true));
          el.addEventListener('mouseleave', () => troca(false));
          el.addEventListener('focusin', () => troca(true));
          el.addEventListener('focusout', () => troca(false));
        } else {
          el.addEventListener('click', (e) => {
            // Link navega, sempre. Nunca chamar preventDefault aqui: o
            // cabeçalho é um destes elementos, e bloquear o clique dele
            // derrubaria a navegação do site inteiro.
            if (e.target.closest('a[href]')) return;
            troca(el.dataset.varianteAtiva !== '1');
          });
        }
      }
    }
    return ligados;
  }

  async function iniciaVariantes() {
    let pares;
    try {
      const r = await fetch('/variantes.json');
      if (!r.ok) return;
      ({ pares } = await r.json());
    } catch { return; }
    if (!Array.isArray(pares)) return;
    aplicaVariantes(pares.filter((par) => arvoreAtiva().querySelector('.' + par.de)));
  }

  // ─────────────────────────────────────────────────────────────────
  //  Carrossel de projetos
  //
  //  O Framer não move nada: ele troca a classe da raiz e o CSS de cada
  //  variante reordena os filhos com `order:`. O DOM é idêntico nos quatro
  //  estados — medido no Framer vivo, os mesmos cards estão presentes em
  //  todos. Por isso o nosso HTML estático reproduz isto sem faltar nada.
  //
  //  O mapa em /carrossel.json sai do cycleOrder do fonte (nkDfbQNR8.js)
  //  cruzado com tools/sonda-carrossel.mjs, que clicou no Framer e mediu
  //  para onde cada controle leva. O fonte sozinho não bastava: o render é
  //  condicional por variante e o mesmo onTap aparece em vários ramos.
  //
  //  Controles, conforme medido:
  //    Vector (1º)  seta anterior      Vector (2º)  seta seguinte
  //    card lateral salta para o projeto que exibe
  //    card ativo   não faz nada
  // ─────────────────────────────────────────────────────────────────

  /**
   * `order` não é animável: o navegador reposiciona de um quadro para o
   * outro. Para ter o movimento do Framer, mede antes e depois, aplica a
   * diferença como transform invertido e deixa a mola levar até zero.
   */
  function animaReordenacao(filhos, antes) {
    const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduzido) return;
    for (const filho of filhos) {
      const de = antes.get(filho);
      if (!de) continue;
      const para = filho.getBoundingClientRect();
      const dx = de.left - para.left, dy = de.top - para.top;
      if (!dx && !dy) continue;
      filho.style.transition = 'none';
      filho.style.transform = `translate(${dx}px, ${dy}px)`;
      // dois quadros: o primeiro assenta o transform, o segundo anima
      requestAnimationFrame(() => requestAnimationFrame(() => {
        filho.style.transition = `transform .4s ${MOLA_CSS}`;
        filho.style.transform = '';
      }));
    }
  }

  function ligaCarrossel(mapa) {
    const raiz = arvoreAtiva();
    const todas = Object.keys(mapa.projetos);
    for (const el of raiz.querySelectorAll(todas.map((c) => '.' + c).join(','))) {
      if (el.dataset.carrosselPronto) continue;

      const atual = [...el.classList].find((c) => todas.includes(c));
      const ciclo = Object.values(mapa.ciclos).find((c) => c.includes(atual));
      if (!ciclo || ciclo.length < 2) continue;

      // Trava obrigatória: se trocar a classe não mexe em nada, não ligar
      // handler nenhum. O acordeão tem par inerte e um clique com
      // preventDefault ali derrubaria a navegação.
      // Medir só os filhos diretos não serve: a raiz tem um único filho e
      // o `order:` das variantes atua em netos. Mede a árvore inteira.
      const posicoes = () => [...el.querySelectorAll('*')]
        .map((n) => { const b = n.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)}`; })
        .join('|');
      const proximo = ciclo[(ciclo.indexOf(atual) + 1) % ciclo.length];
      const antesTeste = posicoes();
      el.classList.replace(atual, proximo);
      const depoisTeste = posicoes();
      el.classList.replace(proximo, atual);
      if (antesTeste === depoisTeste) continue;

      el.dataset.carrosselPronto = '1';

      const vai = (destino) => {
        const agora = [...el.classList].find((c) => todas.includes(c));
        if (!destino || destino === agora) return;
        const filhos = [...el.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().width > 8);
        const antes = new Map(filhos.map((n) => [n, n.getBoundingClientRect()]));
        el.classList.replace(agora, destino);
        animaReordenacao(filhos, antes);
      };

      el.addEventListener('click', (e) => {
        // Link navega, sempre — nunca preventDefault num a[href].
        if (e.target.closest('a[href]')) return;

        const agora = [...el.classList].find((c) => todas.includes(c));
        const i = ciclo.indexOf(agora);

        const seta = e.target.closest('[data-framer-name="Vector"]');
        if (seta) {
          const setas = [...el.querySelectorAll('[data-framer-name="Vector"]')]
            .filter((v) => getComputedStyle(v).cursor === 'pointer');
          const qual = setas.indexOf(seta);
          if (qual === 0) return vai(ciclo[(i - 1 + ciclo.length) % ciclo.length]);
          if (qual === 1) return vai(ciclo[(i + 1) % ciclo.length]);
          return;
        }

        // O Framer pendura o onTap no frame do card, não no rótulo. Um
        // clique pode cair em qualquer um dos dois, então sobe procurando
        // um nome de projeto e, se o nome do frame não for de projeto,
        // desce atrás do rótulo que ele embrulha.
        const doNome = (n) => {
          if (!n) return null;
          const alvo = n.trim().toUpperCase();
          return ciclo.find((c) => (mapa.projetos[c] ?? '').toUpperCase() === alvo) ?? null;
        };
        for (let n = e.target.closest('[data-framer-name]'); n && el.contains(n); n = n.parentElement.closest('[data-framer-name]')) {
          const direto = doNome(n.getAttribute('data-framer-name'));
          if (direto) return vai(direto);
          for (const dentro of n.querySelectorAll('[data-framer-name]')) {
            const achado = doNome(dentro.getAttribute('data-framer-name'));
            if (achado) return vai(achado);
          }
        }
      });
    }
  }

  async function iniciaCarrossel() {
    try {
      const r = await fetch('/carrossel.json');
      if (!r.ok) return;
      const mapa = await r.json();
      if (mapa && mapa.projetos && mapa.ciclos) ligaCarrossel(mapa);
    } catch { /* sem mapa, sem carrossel — o site continua servindo */ }
  }

  const tudo = () => { inicia(); iniciaVariantes(); iniciaCarrossel(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tudo);
  else tudo();

  // A troca de breakpoint põe outra árvore no layout, com os próprios ocultos.
  let redimensionando;
  window.addEventListener('resize', () => {
    clearTimeout(redimensionando);
    redimensionando = setTimeout(tudo, 250);
  });
})();

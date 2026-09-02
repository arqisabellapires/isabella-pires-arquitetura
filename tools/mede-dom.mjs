/**
 * A medição do DOM, num lugar só.
 *
 * Duas ferramentas precisam medir exatamente igual: o extrai-medidas, que
 * transforma a captura do Framer em especificação, e o verifica-secao, que
 * mede o site novo para dizer o que diverge. Se cada um tivesse a sua cópia,
 * elas divergiriam sozinhas e o relatório de diferença passaria a acusar
 * diferença de medidor, não de página.
 *
 * A função é passada inteira para page.evaluate(), então não pode fechar
 * sobre nada do Node.
 */
/**
 * Roda dentro da página. Normaliza o estado de partida dos reveals e mede.
 * Tudo em uma passada só: sair e voltar do contexto por elemento é lento e,
 * pior, deixa o layout mudar entre medidas.
 */
export const MEDE = () => {
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


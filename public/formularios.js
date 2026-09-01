/**
 * Liga os formulários do Framer aos nossos endpoints.
 *
 * O HTML capturado do Framer não tem `action` nem handler — quem tratava o
 * envio era o runtime de 1,4 MB que o processa-framer.mjs remove. O pipeline
 * reinjeta `action`/`method`, então sem JavaScript o envio ainda funciona por
 * POST normal e o endpoint devolve um 303 de volta para a página. Este arquivo
 * só melhora isso: envia por fetch e responde na própria página.
 *
 * Nada é criado no DOM antes do primeiro envio, de propósito: o verificador de
 * fidelidade compara a página carregada com a referência, e um parágrafo de
 * status a mais já contaria como divergência.
 */
(() => {
  'use strict';

  const MENSAGENS = {
    contato: 'Recebido. Retornamos em breve.',
    newsletter: 'Inscrição confirmada.',
    enviando: 'Enviando…',
    falha: 'Não consegui enviar. Tente novamente em instantes.',
  };

  function status(form) {
    let alvo = form.__status;
    if (!alvo) {
      alvo = document.createElement('p');
      alvo.setAttribute('role', 'status');
      alvo.setAttribute('aria-live', 'polite');
      alvo.style.cssText =
        'margin:12px 0 0;font-size:14px;line-height:1.4;font-family:inherit;color:inherit';
      form.appendChild(alvo);
      form.__status = alvo;
    }
    return alvo;
  }

  function botao(form) {
    return form.querySelector('button[type="submit"], [data-reset="button"]');
  }

  async function envia(evento) {
    const form = evento.currentTarget;
    evento.preventDefault();

    const destino = form.getAttribute('action');
    if (!destino) return;

    const tipo = destino.endsWith('/newsletter') ? 'newsletter' : 'contato';
    const alvo = status(form);
    const acao = botao(form);

    alvo.textContent = MENSAGENS.enviando;
    alvo.style.opacity = '0.7';
    if (acao) acao.disabled = true;

    try {
      const resposta = await fetch(destino, {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new FormData(form),
      });
      const corpo = await resposta.json().catch(() => ({}));

      alvo.style.opacity = '1';
      if (resposta.ok && corpo.ok) {
        alvo.textContent = MENSAGENS[tipo];
        form.reset();
      } else {
        alvo.textContent = corpo.erro || MENSAGENS.falha;
      }
    } catch {
      alvo.style.opacity = '1';
      alvo.textContent = MENSAGENS.falha;
    } finally {
      if (acao) acao.disabled = false;
    }
  }

  for (const form of document.querySelectorAll('form[action^="/api/"]')) {
    form.addEventListener('submit', envia);
  }
})();

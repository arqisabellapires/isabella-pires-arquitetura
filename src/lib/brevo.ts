/**
 * Cliente mínimo da API da Brevo. Só o que o site usa: e-mail transacional
 * (formulário de contato) e criação de contato em lista (newsletter do blog).
 *
 * Atenção operacional: a Brevo tem um recurso de "IPs autorizados" que, quando
 * ligado, recusa a chave vinda de qualquer IP fora da lista. As funções da
 * Vercel saem por IPs dinâmicos e não whitelistáveis no plano Hobby, então esse
 * recurso precisa ficar DESLIGADO em app.brevo.com/security/authorised_ips.
 * O sintoma é 401 com code "unauthorized" citando o IP.
 */

const BASE = 'https://api.brevo.com/v3';

export class ErroBrevo extends Error {
  constructor(
    readonly status: number,
    readonly corpo: string,
  ) {
    super(`Brevo respondeu ${status}: ${corpo}`);
    this.name = 'ErroBrevo';
  }
}

async function chama(caminho: string, chave: string, corpo: unknown): Promise<unknown> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: 'POST',
    headers: {
      'api-key': chave,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(corpo),
  });

  const texto = await resposta.text();
  if (!resposta.ok) throw new ErroBrevo(resposta.status, texto);
  return texto ? JSON.parse(texto) : null;
}

export interface Contato {
  nome: string;
  email: string;
  telefone: string;
  servico: string;
  mensagem: string;
}

/** Encaminha um lead do formulário para a caixa da cliente. */
export function enviaEmailDeContato(
  chave: string,
  remetente: { nome: string; email: string },
  destino: string,
  dados: Contato,
) {
  const linhas: [string, string][] = [
    ['Nome', dados.nome],
    ['E-mail', dados.email],
    ['Telefone', dados.telefone || '—'],
    ['Serviço', dados.servico || '—'],
  ];

  return chama('/smtp/email', chave, {
    sender: { name: remetente.nome, email: remetente.email },
    to: [{ email: destino }],
    // Responder no e-mail encaminhado responde direto para o lead.
    replyTo: { email: dados.email, name: dados.nome },
    subject: `Contato pelo site — ${dados.nome}`,
    textContent: [
      ...linhas.map(([r, v]) => `${r}: ${v}`),
      '',
      'Mensagem:',
      dados.mensagem,
    ].join('\n'),
    htmlContent: [
      '<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.6">',
      '<table cellpadding="0" cellspacing="0" style="border-collapse:collapse">',
      ...linhas.map(
        ([r, v]) =>
          `<tr><td style="padding:2px 12px 2px 0;color:#888">${r}</td>` +
          `<td style="padding:2px 0"><strong>${escapa(v)}</strong></td></tr>`,
      ),
      '</table>',
      '<p style="margin:16px 0 4px;color:#888">Mensagem</p>',
      `<p style="margin:0;white-space:pre-wrap">${escapa(dados.mensagem)}</p>`,
      '</div>',
    ].join(''),
    tags: ['formulario-contato'],
  });
}

/** Inscreve um e-mail na lista da newsletter do blog. */
export function inscreveNaNewsletter(chave: string, listaId: number, email: string) {
  return chama('/contacts', chave, {
    email,
    listIds: [listaId],
    // Reinscrever um contato já existente não pode virar erro 400.
    updateEnabled: true,
  });
}

function escapa(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

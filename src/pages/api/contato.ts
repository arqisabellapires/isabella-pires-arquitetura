import type { APIRoute } from 'astro';
import { enviaEmailDeContato, ErroBrevo } from '~/lib/brevo';
import { caiuNaIsca, emailPlausivel, excedeuLimite, texto } from '~/lib/antispam';
import { responde } from '~/lib/resposta';
import { env, envObrigatoria } from '~/lib/ambiente';

// Rota de servidor dentro de um site estático.
export const prerender = false;

/** O Framer nomeia os campos assim; aceitamos também a grafia ASCII. */
function campo(dados: FormData, nomes: string[], limite: number): string {
  for (const nome of nomes) {
    const valor = texto(dados, nome, limite);
    if (valor) return valor;
  }
  return '';
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let dados: FormData;
  try {
    dados = await request.formData();
  } catch {
    return responde(request, { ok: false, erro: 'Não consegui ler o formulário.' }, 400);
  }

  // Robô que preencheu campo escondido recebe sucesso e nada acontece:
  // devolver erro só ensina o robô a tentar de novo sem a isca.
  if (caiuNaIsca(dados)) return responde(request, { ok: true }, 200);

  const contato = {
    nome: campo(dados, ['Name', 'nome'], 120),
    email: campo(dados, ['Email', 'email'], 254),
    telefone: campo(dados, ['Telefone', 'telefone'], 40),
    servico: campo(dados, ['Serviço', 'Servico', 'servico'], 80),
    mensagem: campo(dados, ['Mensagem', 'mensagem'], 5000),
  };

  if (!contato.nome || !contato.mensagem) {
    return responde(request, { ok: false, erro: 'Preencha nome e mensagem.' }, 422);
  }
  if (!emailPlausivel(contato.email)) {
    return responde(request, { ok: false, erro: 'Confira o e-mail informado.' }, 422);
  }

  // O limite fica depois da validação de propósito: o que ele protege é a cota
  // de 300 envios/dia da Brevo, e envio recusado por validação não consome cota.
  // Contar tentativa inválida trancaria por 10 minutos quem só errou o e-mail.
  if (excedeuLimite(clientAddress ?? 'desconhecido')) {
    return responde(request, { ok: false, erro: 'Muitos envios seguidos. Tente de novo em alguns minutos.' }, 429);
  }

  try {
    await enviaEmailDeContato(
      envObrigatoria('BREVO_API_KEY'),
      {
        nome: env('BREVO_REMETENTE_NOME') ?? 'Site Isabella Pires',
        email: envObrigatoria('BREVO_REMETENTE_EMAIL'),
      },
      envObrigatoria('BREVO_DESTINO_EMAIL'),
      contato,
    );
  } catch (erro) {
    // O corpo da resposta da Brevo diz o motivo real (domínio não autenticado,
    // IP recusado, cota estourada). Fica no log da função, nunca na resposta.
    console.error('[contato] falha ao enviar', erro instanceof ErroBrevo ? erro.corpo : erro);
    return responde(request, { ok: false, erro: 'Não consegui enviar agora. Tente novamente em instantes.' }, 502);
  }

  return responde(request, { ok: true }, 200);
};

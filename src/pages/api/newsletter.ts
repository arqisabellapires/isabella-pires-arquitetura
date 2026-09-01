import type { APIRoute } from 'astro';
import { enviaBoasVindas, inscreveNaNewsletter, ErroBrevo } from '~/lib/brevo';
import { caiuNaIsca, emailPlausivel, excedeuLimite, texto } from '~/lib/antispam';
import { env, envObrigatoria } from '~/lib/ambiente';
import { responde } from '~/lib/resposta';

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let dados: FormData;
  try {
    dados = await request.formData();
  } catch {
    return responde(request, { ok: false, erro: 'Não consegui ler o formulário.' }, 400);
  }

  if (caiuNaIsca(dados)) return responde(request, { ok: true }, 200);

  const email = texto(dados, 'Email', 254) || texto(dados, 'email', 254);
  if (!emailPlausivel(email)) {
    return responde(request, { ok: false, erro: 'Confira o e-mail informado.' }, 422);
  }

  // O limite fica depois da validação de propósito: o que ele protege é a cota
  // de 300 envios/dia da Brevo, e envio recusado por validação não consome cota.
  // Contar tentativa inválida trancaria por 10 minutos quem só errou o e-mail.
  if (excedeuLimite(clientAddress ?? 'desconhecido')) {
    return responde(request, { ok: false, erro: 'Muitos envios seguidos. Tente de novo em alguns minutos.' }, 429);
  }

  const chave = envObrigatoria('BREVO_API_KEY');

  try {
    await inscreveNaNewsletter(chave, Number(envObrigatoria('BREVO_LISTA_NEWSLETTER_ID')), email);
  } catch (erro) {
    console.error('[newsletter] falha ao inscrever', erro instanceof ErroBrevo ? erro.corpo : erro);
    return responde(request, { ok: false, erro: 'Não consegui inscrever agora. Tente novamente em instantes.' }, 502);
  }

  // A inscrição já valeu; se as boas-vindas falharem, isso é problema nosso,
  // não da pessoa. Vira log.
  try {
    await enviaBoasVindas(chave, {
      nome: env('BREVO_REMETENTE_NOME') ?? 'Site Isabella Pires',
      email: envObrigatoria('BREVO_REMETENTE_EMAIL'),
    }, email);
  } catch (erro) {
    console.error('[newsletter] falha nas boas-vindas', erro instanceof ErroBrevo ? erro.corpo : erro);
  }

  return responde(request, { ok: true }, 200);
};

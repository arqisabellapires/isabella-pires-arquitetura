import type { APIRoute } from 'astro';
import { inscreveNaNewsletter, ErroBrevo } from '~/lib/brevo';
import { caiuNaIsca, emailPlausivel, excedeuLimite, texto } from '~/lib/antispam';
import { envObrigatoria } from '~/lib/ambiente';
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

  if (excedeuLimite(clientAddress ?? 'desconhecido')) {
    return responde(request, { ok: false, erro: 'Muitos envios seguidos. Tente de novo em alguns minutos.' }, 429);
  }

  const email = texto(dados, 'Email', 254) || texto(dados, 'email', 254);
  if (!emailPlausivel(email)) {
    return responde(request, { ok: false, erro: 'Confira o e-mail informado.' }, 422);
  }

  try {
    await inscreveNaNewsletter(
      envObrigatoria('BREVO_API_KEY'),
      Number(envObrigatoria('BREVO_LISTA_NEWSLETTER_ID')),
      email,
    );
  } catch (erro) {
    console.error('[newsletter] falha ao inscrever', erro instanceof ErroBrevo ? erro.corpo : erro);
    return responde(request, { ok: false, erro: 'Não consegui inscrever agora. Tente novamente em instantes.' }, 502);
  }

  return responde(request, { ok: true }, 200);
};

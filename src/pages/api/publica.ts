/**
 * Dispara o rebuild do site depois que um artigo é publicado.
 *
 * Por que existe uma rota em vez de o painel chamar a Vercel direto: a URL
 * do Deploy Hook é segredo — quem a tiver dispara builds à vontade. Ela fica
 * no servidor, e o navegador só fala com esta rota.
 *
 * E por que a rota confere quem chama: sem isso, qualquer visitante poderia
 * pedir build em looping. Só quem está em `editores` passa.
 */
import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { env, envObrigatoria } from '~/lib/ambiente';

export const prerender = false;

const json = (corpo: object, status: number) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export const POST: APIRoute = async ({ request }) => {
  const cabecalho = request.headers.get('authorization') ?? '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  if (!token) return json({ ok: false, erro: 'Sem credencial.' }, 401);

  const url = envObrigatoria('PUBLIC_SUPABASE_URL');
  const servico = envObrigatoria('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(url, servico, { auth: { persistSession: false } });

  // O token vem do navegador: só vale depois que o Supabase confirma.
  const { data: dono, error } = await supabase.auth.getUser(token);
  if (error || !dono?.user) return json({ ok: false, erro: 'Credencial inválida.' }, 401);

  const { data: editor } = await supabase
    .from('editores').select('id').eq('id', dono.user.id).maybeSingle();
  if (!editor) return json({ ok: false, erro: 'Você não tem permissão para publicar.' }, 403);

  const gancho = env('VERCEL_DEPLOY_HOOK');
  if (!gancho) {
    // O artigo já está salvo; só o site é que não se atualiza sozinho.
    return json(
      { ok: false, erro: 'VERCEL_DEPLOY_HOOK não configurado — o artigo foi salvo, mas o site não vai atualizar sozinho.' },
      500,
    );
  }

  const resposta = await fetch(gancho, { method: 'POST' });
  if (!resposta.ok) return json({ ok: false, erro: 'A Vercel recusou o pedido de build.' }, 502);

  return json({ ok: true }, 202);
};

/**
 * Cliente do Supabase para o PAINEL (roda no navegador da editora).
 *
 * Usa a chave anônima de propósito: quem manda é a RLS do banco, não o
 * segredo da chave. A `SUPABASE_SERVICE_ROLE_KEY` nunca aparece aqui — ela
 * ignora RLS e vive só nas ferramentas de administração e nas rotas de
 * servidor.
 */
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // O link de recuperação chega com o token na âncora (#access_token=…).
      // Sem isto o cliente o ignora e a tela de nova senha nunca abre.
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  },
);

/** Manda para o login quem não estiver autenticado. Devolve a sessão. */
export async function exigeSessao() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    window.location.href = '/painel/entrar';
    return null;
  }
  return data.session;
}

/**
 * O loader que troca a fonte dos artigos: markdown local → Supabase.
 *
 * É este arquivo o "ponto de troca" que o comentário de content.config.ts
 * anunciava desde a V1. Ele entrega ao Astro exatamente o mesmo formato que
 * o `glob()` entregava, então nem as páginas nem os componentes mudam.
 *
 * Duas coisas que ele resolve, e que valem saber:
 *
 * 1. **Compatibilidade dos nomes.** O banco usa `snake_case` (convenção do
 *    Postgres) e o schema do Astro usa `camelCase`. A tradução acontece
 *    aqui, num lugar só.
 *
 * 2. **A capa.** No markdown, `capa` era um caminho local e o `image()` do
 *    Astro devolvia um objeto com largura e altura. Vindo do banco, é uma
 *    URL do Storage. Por isso o schema de `artigos` passa a aceitar os dois
 *    (ver content.config.ts) e as páginas continuam entregando `d.capa` ao
 *    <Image> como sempre.
 *
 * Se o banco estiver fora do ar durante um build, o build FALHA de
 * propósito: publicar o site sem os artigos seria pior do que não publicar.
 */
import type { Loader } from 'astro/loaders';
import { createClient } from '@supabase/supabase-js';

/** Uma linha da tabela `artigos`, como o Postgres a devolve. */
type LinhaArtigo = {
  slug: string;
  titulo: string;
  resumo: string;
  capa: string;
  capa_largura: number | null;
  capa_altura: number | null;
  capa_alt: string;
  corpo: string;
  publicado_em: string;
  atualizado_em: string | null;
  autor: string;
  categoria: string;
  tags: string[];
  publicado: boolean;
  destaque: boolean;
  seo_titulo: string | null;
  seo_descricao: string | null;
  slug_antigo: string | null;
};

export function artigosDoSupabase(): Loader {
  return {
    name: 'artigos-supabase',

    async load({ store, logger, parseData }) {
      const url = import.meta.env.PUBLIC_SUPABASE_URL;
      const chave = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

      if (!url || !chave) {
        throw new Error(
          'PUBLIC_SUPABASE_URL ou PUBLIC_SUPABASE_ANON_KEY não estão no ambiente. ' +
            'O blog lê do Supabase desde a Fase 5 — sem elas o build não tem como montar /artigos.',
        );
      }

      const supabase = createClient(url, chave, { auth: { persistSession: false } });

      /*
        A anon key só enxerga `publicado = true` (a política do banco cuida
        disso), então o rascunho nunca chega ao site nem por engano. O filtro
        abaixo é redundante de propósito: deixa a intenção explícita para
        quem ler, e protege se a política mudar.
      */
      const { data, error } = await supabase
        .from('artigos')
        .select('*')
        .eq('publicado', true)
        .order('publicado_em', { ascending: false })
        .returns<LinhaArtigo[]>();

      if (error) {
        throw new Error(`Não consegui ler os artigos do Supabase: ${error.message}`);
      }

      store.clear();

      for (const linha of data ?? []) {
        const dados = {
          titulo: linha.titulo,
          resumo: linha.resumo,
          capa: linha.capa,
          capaLargura: linha.capa_largura,
          capaAltura: linha.capa_altura,
          capaAlt: linha.capa_alt,
          publicadoEm: linha.publicado_em,
          ...(linha.atualizado_em ? { atualizadoEm: linha.atualizado_em } : {}),
          autor: linha.autor,
          categoria: linha.categoria,
          tags: linha.tags ?? [],
          publicado: linha.publicado,
          destaque: linha.destaque,
          ...(linha.seo_titulo ? { seoTitulo: linha.seo_titulo } : {}),
          ...(linha.seo_descricao ? { seoDescricao: linha.seo_descricao } : {}),
          ...(linha.slug_antigo ? { slugAntigo: linha.slug_antigo } : {}),
        };

        // `parseData` roda o mesmo zod do content.config.ts: se um artigo vier
        // torto do banco, o build reclama aqui, e não numa página quebrada.
        const validado = await parseData({ id: linha.slug, data: dados });
        const corpo = linha.corpo ?? '';

        /*
          O corpo dos 25 artigos migrados já é HTML (veio assim do Framer), e
          o editor também grava HTML. Passar isso por `renderMarkdown` não é
          inofensivo: o markdown envolve linhas soltas em <p> e escapa o que
          parecer sintaxe, o que estragaria a marcação existente.

          Como o <Content /> da página apenas injeta `rendered.html`, entregar
          o HTML direto é o caminho certo — e o único que preserva o que a
          `artigo.css` foi medida para estilizar.
        */
        store.set({
          id: linha.slug,
          data: validado,
          body: corpo,
          rendered: { html: corpo },
        });
      }

      logger.info(`${data?.length ?? 0} artigo(s) lidos do Supabase`);
    },
  };
}

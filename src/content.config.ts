import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { artigosDoSupabase } from './lib/loader-supabase';

/**
 * O `loader` é o ponto de troca entre a V1 e a V2. **A troca aconteceu.**
 *
 * Antes: lia markdown de src/content/artigos/.
 * Agora: `artigosDoSupabase()` consulta o banco. Como prometido no
 * planejamento, os schemas e as páginas que consomem getCollection() não
 * mudaram — só esta linha e o tipo de `capa` (ver abaixo).
 *
 * Os markdown antigos continuam em src/content/artigos/ como acervo: foram
 * a fonte da carga inicial (`tools/importa-artigos.mjs`) e servem de
 * conferência. Não são mais lidos no build.
 */

const artigos = defineCollection({
  loader: artigosDoSupabase(),
  schema: ({ image }) =>
    z.object({
      titulo: z.string().max(120),
      resumo: z.string().max(300),
      /*
        Vindo do Supabase, `capa` é a URL pública do Storage — uma string.
        No markdown era um arquivo local, e o `image()` devolvia um objeto
        com largura e altura. Aceitamos os dois para que o acervo em
        src/content/ continue validando, e para não ter de tocar no
        <Image> das páginas.
      */
      capa: z.union([image(), z.string().url()]),
      /*
        Só existem quando a capa é remota: o <Image> exige largura e altura
        para não deixar a página pular enquanto ela carrega. Com arquivo
        local, o próprio Astro mede.
      */
      capaLargura: z.number().int().positive().nullable().optional(),
      capaAltura: z.number().int().positive().nullable().optional(),
      capaAlt: z.string(),
      publicadoEm: z.coerce.date(),
      atualizadoEm: z.coerce.date().optional(),
      autor: z.string().default('Isabella Pires'),
      categoria: z.string().default('Arquitetura'),
      tags: z.array(z.string()).default([]),
      // Minutos de leitura: o painel calcula do corpo, mas a Isabella pode
      // corrigir à mão. Nulo nos artigos antigos que nunca passaram por lá.
      tempoLeitura: z.number().int().positive().nullable().optional(),
      /** Falso mantém o artigo fora da listagem, do sitemap e do build. */
      publicado: z.boolean().default(true),
      destaque: z.boolean().default(false),
      /** Sobrescreve o <title>/description se o SEO pedir algo diferente do título. */
      seoTitulo: z.string().max(60).optional(),
      seoDescricao: z.string().max(160).optional(),
      /** Slug antigo no Framer, para gerar o 301. */
      slugAntigo: z.string().optional(),
    }),
});

const projetos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/projetos' }),
  schema: ({ image }) =>
    z.object({
      titulo: z.string().max(120),
      resumo: z.string().max(300),
      capa: image(),
      capaAlt: z.string(),
      galeria: z
        .array(z.object({ imagem: image(), alt: z.string(), legenda: z.string().optional() }))
        .default([]),
      local: z.string().optional(),
      ano: z.number().int().optional(),
      areaM2: z.number().positive().optional(),
      categoria: z.enum(['Residencial', 'Comercial', 'Interiores', 'Reforma']),
      /** Menor aparece primeiro na listagem. */
      ordem: z.number().int().default(100),
      publicado: z.boolean().default(true),
      destaque: z.boolean().default(false),
      seoTitulo: z.string().max(60).optional(),
      seoDescricao: z.string().max(160).optional(),
      slugAntigo: z.string().optional(),
    }),
});

export const collections = { artigos, projetos };

import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * O `loader` é o ponto de troca entre a V1 e a V2.
 *
 * Hoje: lê markdown de src/content/.
 * Na Fase 5 (CMS): este glob() vira um loader que consulta o Supabase.
 * Os schemas e as páginas que consomem getCollection() não mudam.
 */

const artigos = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/artigos' }),
  schema: ({ image }) =>
    z.object({
      titulo: z.string().max(120),
      resumo: z.string().max(300),
      capa: image(),
      capaAlt: z.string(),
      publicadoEm: z.coerce.date(),
      atualizadoEm: z.coerce.date().optional(),
      autor: z.string().default('Isabella Pires'),
      categoria: z.string().default('Arquitetura'),
      tags: z.array(z.string()).default([]),
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

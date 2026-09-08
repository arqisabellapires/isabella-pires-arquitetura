// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://www.isabellapiresarquitetura.com.br',
  output: 'static',
  adapter: vercel(),
  integrations: [
    mdx(),
    /* O painel do blog é área de trabalho da cliente, não conteúdo: fora do
       sitemap. As páginas dele também mandam `noindex`, e o robots.txt
       proíbe — três camadas, porque uma URL de painel indexada é convite. */
    sitemap({ filter: (pagina) => !pagina.includes('/painel') }),
  ],
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  image: {
    // Formatos modernos primeiro; o fallback é resolvido pelo <picture>.
    responsiveStyles: true,
    /*
      As capas do blog vêm do Storage do Supabase depois que o CMS entrou.
      Sem autorizar o host aqui, o <Image> se recusa a otimizar remoto e as
      capas sairiam sem redimensionar. É o único host externo do projeto — e
      só no BUILD: o navegador do visitante continua não falando com
      ninguém de fora, porque as imagens saem otimizadas para o nosso
      domínio. A Política de Cookies promete isso ao visitante.
    */
    domains: ['bnvjvletrqbvmxgsptpw.supabase.co'],
  },
  build: { inlineStylesheets: 'auto' },
});

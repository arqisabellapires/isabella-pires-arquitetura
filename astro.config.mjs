// @ts-check
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://www.isabellapiresarquitetura.com.br',
  output: 'static',
  adapter: vercel(),
  integrations: [mdx(), sitemap()],
  prefetch: { prefetchAll: true, defaultStrategy: 'viewport' },
  image: {
    // Formatos modernos primeiro; o fallback é resolvido pelo <picture>.
    responsiveStyles: true,
  },
  build: { inlineStylesheets: 'auto' },
});

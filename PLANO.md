# Isabella Pires Arquitetura — plano de migração

> **Estado atual, ferramentas e próximos passos: [HANDOFF.md](HANDOFF.md).**

Substituição do site em Framer por um site próprio em código.

## Decisões fechadas

| Tema | Decisão | Motivo |
|---|---|---|
| Framework | Astro 7 | Site de conteúdo; 0 KB de JS por padrão; islands para motion |
| Estilo | CSS nativo + tokens | 8 páginas com estética autoral; controle total de escala e ritmo |
| Conteúdo V1 | Markdown em `src/content/` | Content Layer com loader plugável |
| Conteúdo V2 | Supabase pelo mesmo loader | Troca a fonte sem reescrever página |
| Visual | Fiel ao layout aprovado | Menor risco com a cliente; beleza vem da execução |
| URLs | ASCII + 301 das antigas | Higiene definitiva; SEO acumulado é baixo |
| Fontes | Cairo Play, Mulish, Fragment Mono self-hospedadas | Mesmas do original, todas OFL; 120 KB no total |
| E-mail | Brevo (300/dia grátis) | O log da Brevo já é o arquivo de leads; sem banco na V1 |
| Hospedagem | Vercel Hobby | **Risco aceito** — ver abaixo |
| Analytics | GA4 + Clarity | — |

### Risco aceito: Vercel Hobby
Os termos do plano Hobby cobrem uso pessoal e não-comercial; este é um site
comercial. Se a Vercel notificar, a mitigação é trocar o adapter do Astro para
`@astrojs/cloudflare` e apontar o DNS — cerca de uma hora de trabalho.

### Risco crítico: acesso ao Framer
A assinatura vence em breve. Os ~26 artigos e os projetos só saem limpos pelo
plugin **CMS Export** enquanto ela existir. Perder o acesso custa 21 artigos.

## Fases

- [x] **0. Resgate** — exportar CSV do Framer *(tarefa do Gabriel, urgente)*
- [x] **1. Fundação** — Astro, tokens, fontes, layout base, SEO, importador
- [ ] **2. Site público** — 8 páginas, projetos, artigos, motion, cursor, ilustrações
- [ ] **3. SEO e captação** — JSON-LD, sitemap, formulário Brevo, GA4, Clarity
- [ ] **4. Lançamento** — Vercel, DNS registro.br, 301, Search Console, cortar Framer
- [ ] **5. CMS (V2)** — Supabase, autenticação, painel dela
- [ ] **6. Conteúdo** — chegar a 40 artigos

## Importar do Framer

```bash
# 1. Framer → Plugins → CMS Export → salvar em _importar/
node tools/importa-framer.mjs _importar/artigos.csv artigos
node tools/importa-framer.mjs _importar/projetos.csv projetos
# 2. baixar as imagens listadas em _importar/imagens-para-baixar.txt
```

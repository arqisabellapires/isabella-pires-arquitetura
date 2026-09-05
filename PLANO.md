# Isabella Pires Arquitetura — plano

> **Contexto completo, para quem está chegando:
> [docs/ENTENDA-O-PROJETO.md](docs/ENTENDA-O-PROJETO.md).**
> **Estado corrente do repositório, ferramentas e armadilhas: [HANDOFF.md](HANDOFF.md).**
> **Desenho completo e fases: [docs/superpowers/specs/](docs/superpowers/specs/).**

Substituição do site em Framer por site próprio em código, vitalício.
O Framer vence em **30 de setembro de 2026**.

## Rumo (decidido em 01/09/2026)

**Reconstruir o site em Astro usando as capturas do Framer como
especificação medida por máquina**, com cutover página por página.
O HTML processado do Framer que está no ar hoje (`public/*.html`) é a
ponte, não o destino: vai sendo substituído a cada página aprovada.

- Spec da reconstrução: [2026-09-01-reconstrucao-astro-design.md](docs/superpowers/specs/2026-09-01-reconstrucao-astro-design.md)
- Spec do CMS de blog reutilizável: [2026-09-01-cms-blog-reutilizavel-design.md](docs/superpowers/specs/2026-09-01-cms-blog-reutilizavel-design.md)

## Decisões fechadas

| Tema | Decisão | Motivo |
|---|---|---|
| Estratégia | **Reconstruir em Astro, medindo a captura do Framer** (spec §5) | HTML processado não é componentizável nem indexável; reconstrução de memória não converge — reconstrução medida, com portão, converge |
| Fidelidade | Indistinguível pela cliente, com liberdade para corrigir o que está errado sem parecer diferente (semântica, alt, meta, responsividade) | Pixel-perfect forçaria a carregar as esquisitices do Framer |
| Aceitação | Lado a lado (`compara.html`) aprovado pelo Gabriel, por seção e breakpoint; o portão de pixel é diagnóstico | O mapa de diferença assusta e não diz o que fazer |
| Breakpoints | Os do Framer: ≥1200 / 810–1199.98 / ≤809.98 | As capturas foram feitas neles; mudar é decisão de depois |
| Framework | Astro, `output: 'static'`, APIs e painel sob demanda | Zero JS por padrão; islands só para motion |
| Estilo | CSS nativo + tokens **derivados das medidas** | Nenhum valor visual sai da memória |
| Motion | Implementação própria; só os valores (molas, estados) vêm do fonte do Framer; mola em CSS `linear()` | Fatos do design, não código deles |
| Conteúdo | Coleções do Astro (`artigos`, `projetos`) + `conteudo.ts` | Componente não tem copy |
| CMS | **Painel próprio** (Supabase Auth + Postgres + Storage), pacote reutilizável `packages/cms-blog`; site continua estático, publicar dispara rebuild | O Gabriel vai reusar em outros sites; custo zero recorrente |
| SEO | Busca **local** (Maringá): title/description únicos com serviço + cidade, `LocalBusiness`, `Article`, sitemap, 301, Search Console | Foi medido: o site nunca concorreu por busca local, e é a única que ganha |
| URLs | ASCII + 301 das antigas | Higiene definitiva |
| Fontes | As mesmas do original, self-hospedadas | Já em `public/fontes/` |
| E-mail | Brevo | Log da Brevo é o arquivo de leads |
| Hospedagem | Vercel Hobby — **risco aceito** | Mitigação: adapter Cloudflare |
| Analytics | GA4 + Clarity | — |
| Versionamento | GitHub, repositório público; o que é do Framer fica fora do git | Código proprietário deles |

**O Gabriel dirige o texto.** Nada de copy, alt, title ou description
inventados. Melhorias visíveis só depois de a página estar idêntica, e
ficam anotadas em `docs/melhorias-depois.md` até lá.

## Rumo revisado (05/09/2026): o Figma é a fonte de verdade

O plano original mandava reconstruir medindo as capturas do Framer. Isso
mudou: **o design existe em Figma** (`w03gcodehy5qey828y58hS`), e o design é
uma fonte melhor que a renderização do Framer — traz a intenção, nomeada e
navegável, em vez das esquisitices da ferramenta.

A divisão passou a ser:

| Assunto | Fonte de verdade |
|---|---|
| Layout, tipografia, cor, espaçamento | **Figma**, extraído para `_figma/` |
| Animação | `_capturas/motion-fichas.json` (o Figma não tem motion) |
| Texto | HTML das capturas e `conteudo.ts` |
| Responsivo | Decisão nossa: **o Figma só tem 1920px** |

Detalhe em [docs/PLANO-FIGMA.md](docs/PLANO-FIGMA.md).

### O que foi entregue nessa rodada

- **Fase A — tipografia.** Das quatro famílias do design, só Mulish
  carregava; o `fontes.css` trazia 73 faces de Inter, que o design não usa.
  Faberge e Arboria não são livres: entraram Cormorant Garamond e Jost como
  substitutas, sob alias com o nome original.
- **Fase B — tokens e motion.** `tokens.figma.css` (88 valores) e
  `motion.css` (as 17 molas em `linear()` nativo). `motion` e `lenis` saíram
  do `package.json`.
- **Fase C — cabeçalho, rodapé, wordmark.**
- **Fase D — as 7 telas**, todas entre 94% e 111% da altura do Figma.
- **Fase E — as animações**, 15 das 17 molas aplicadas.
- **Fase F — rotas, responsivo, portões.**

### Portões (todos provados com o defeito dentro)

```bash
npx astro build                      # 39 páginas
node tools/valida-fontes.mjs         # as 12 famílias carregam no Chromium
node tools/valida-tokens.mjs         # o CSS de tokens sobrevive ao parser
node tools/audita-paginas.mjs        # estrutura, metadados, contraste real
node tools/verifica-revela.mjs       # nada fica invisível ao rolar
node tools/verifica-responsivo.mjs   # nada vaza para o lado
node tools/tira-foto.mjs             # fotografa o dist servido
```

### O que continua pendente

- **Os 20 `alt` de imagem de projeto.** Texto é do Gabriel; não se inventa.
- **As três páginas de política** (Termos, Privacidade, Cookies).
- **Lighthouse, GA4 e Search Console.**
- **O CMS de blog** — módulo à parte, decidido em 05/09/2026.
- **O push.** A conta `gabrielfeelix` tem leitura mas não escrita no
  repositório da cliente; os commits estão locais.

## Fases

Ordem por dependência. Sem datas. Detalhe e portões de saída na spec.

- [x] **0. Antes que algo vença** — gravações das interações no Framer vivo,
      fichas de movimento, backup fora do repo, estancar os 20 artigos em 404,
      sitemap provisório + Search Console.
- [x] **1. Fundação** (parcial: medidas, tokens e portões prontos; o
      `compara.html` lado a lado depende da sua aprovação) — `extrai-medidas`, `deriva-tokens`, `compara`,
      `verifica-secao`, `verifica-comportamento`; cabeçalho e rodapé
      aprovados nos 3 breakpoints (prova do método).
- [x] **2. Páginas, com cutover** — 39 rotas em Astro, `public/` sem HTML — `/artigos/[slug]` + `/artigos/` → home →
      `/servicos/` → `/projetos/*` → `/sobre-nos/` → `/contato/`. Cada uma
      apaga a sua pasta em `public/` no mesmo PR.
- [~] **3. SEO local, performance, lançamento** — JSON-LD, sitemap, 301 e
      auditoria feitos; faltam Lighthouse, GA4/Clarity e Search Console — meta por rota, JSON-LD,
      sitemap, 301, GA4/Clarity, Lighthouse ≥ 95, alt, Search Console.
      Externo: Perfil da Empresa no Google (Isabella).
- [ ] **4. CMS reutilizável** — spec própria. Depende da 2.
- [ ] **5. Conteúdo local** — pauta com Maringá; chegar a 40 posts.

## Riscos

- **Framer vence em 30/09/2026.** Tudo que precisa do original em execução
  é Fase 0.
- **Vercel Hobby** em site comercial — aceito; troca de adapter se
  notificarem.
- **Brevo** travada por IP autorizado, destino vazio e DKIM — fora do
  código; lista no HANDOFF §4.6.

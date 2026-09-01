# Handoff — Isabella Pires Arquitetura

Migração do site do Framer para código próprio. Este documento é o estado
completo do projeto. Leia antes de tocar em qualquer coisa.

---

## 1. O que é o projeto

A cliente (Isabella Pires, arquiteta) tem um site no Framer em
`www.isabellapiresarquitetura.com.br`. Vamos substituí-lo por um site próprio,
hospedado na Vercel, na conta dela. O objetivo declarado pelo Gabriel é
**SEO e beleza**, e o site novo tem que ficar **idêntico** ao atual —
ele dirige as melhorias depois, uma a uma.

Fases combinadas: resgate do conteúdo → site 1:1 no ar → CMS de blog no
Supabase → produção de ~40 posts.

---

## 2. Decisões fechadas (não reabrir sem falar com o Gabriel)

| Tema | Decisão |
|---|---|
| Estratégia | **Processar o HTML renderizado do Framer**, não reconstruir à mão |
| Responsivo | Capturar os 3 breakpoints e empilhar no mesmo HTML |
| Fidelidade | Portão de pixel: falha acima de 0,5% de divergência |
| Hospedagem | Vercel Hobby — **risco aceito** (termos cobrem uso não-comercial) |
| Versionamento | GitHub, repositório **público** por ora |
| E-mail | Brevo (300/dia grátis); o log da Brevo é o arquivo de leads |
| Banco/CMS | Supabase (fase posterior) |
| Analytics | GA4 + Microsoft Clarity |
| URLs | ASCII, com 301 das antigas (que tinham acento) |
| Domínio | registro.br, apontamento manual |

### Por que não reconstruir à mão
Foi tentado. A home reconstruída divergia da referência em **14 pontos**
(títulos inventados, seções omitidas, números errados). A reconstrução de
olho não converge. Ver commits `cb20c52` e `821f036` para o histórico.

### Por que processar o HTML funciona
Medido: o HTML renderizado do Framer é **pixel-idêntico sem nenhum
JavaScript** (0,00% de diferença, 90 pixels em 3,5 milhões). O runtime do
Framer é 1,4 MB que não afeta a renderização estática.

É também o que a indústria faz — os serviços pagos (NoCodeXport, FramerExport,
ConvertFramer) vendem exatamente isso: renderizam o site publicado num browser
e capturam a saída. O Framer não tem export nativo, por decisão de lock-in.

---

## 3. Estado atual

### Funciona e está verificado
- **13 das 14 páginas em 0,00–0,10% de divergência** no desktop
- Imagens convertidas para WebP: **71,2 MB → 25,7 MB (−64%)**, sem regressão
- Fontes self-hospedadas (3 origens: Google, assets do Framer, Fontshare)
- Deploy automático: commit → push → build → Vercel
- No ar: https://isabella-pires-arquitetura.vercel.app

### Não funciona ainda
- **Celular: 0 de 14 páginas passam** (12% a 71% de divergência). Causa
  diagnosticada: o Framer emite **DOM diferente por breakpoint** (645 nós no
  desktop, 628 no celular). O snapshot atual só tem a árvore de desktop.
  Solução já validada na home — ver seção 5.
- **4 interações mortas**: carrossel de projetos, acordeão de serviços,
  menu de celular e scroll reveals. Sem o runtime do Framer, nada disso roda.
- **Listagem do blog** (`/artigos/`) não é reproduzível estaticamente: busca
  os posts do CMS em tempo de execução. A própria referência mede alturas
  diferentes a cada carregamento (2778, 5073, 5532 px). Vira template do CMS.

---

## 4. Ferramentas no repositório

Todas em `tools/`, todas re-executáveis.

| Script | O que faz |
|---|---|
| `captura-breakpoints.mjs` | Captura as 14 páginas × 3 breakpoints do site **vivo** → `_capturas/` |
| `funde-breakpoints.mjs` | Funde as 3 capturas de uma página num HTML só, com media queries |
| `processa-framer.mjs` | Tira o runtime, reescreve assets e links, copia imagens e fontes → `public/` |
| `otimiza-imagens.mjs` | Converte para WebP e reescreve as referências no HTML |
| `verifica-fidelidade.mjs` | **O portão.** Compara cada página com a original, pixel a pixel |
| `importa-framer.mjs` | Converte os CSV do CMS do Framer em markdown |

### Como rodar o ciclo completo
```bash
node tools/captura-breakpoints.mjs      # só enquanto o Framer existir
node tools/processa-framer.mjs
node tools/otimiza-imagens.mjs
node tools/verifica-fidelidade.mjs                    # desktop
node tools/verifica-fidelidade.mjs --largura 390      # celular
```

O verificador escreve mapas de diferença em `.diffs/` (vermelho = divergente)
para toda página que passar do limite.

### Armadilhas que já custaram tempo
1. O clone salva variantes de `srcset` como `base@query`, **não** `base?query`.
2. O `&` no HTML vem como `&amp;` — precisa decodificar para achar o arquivo
   em disco. Sem isso o fallback pega a variante errada: imagem certa,
   resolução errada. Esse bug sozinho valia 26 pontos percentuais de divergência.
3. As fontes vêm de **três** origens distintas. Tratar só o Google deixa tudo
   em fallback e o diff nunca zera.
4. `(?is)` é sintaxe de Python. Em JavaScript são flags: `/regex/gis`.

---

## 5. Próximo passo, já validado

Fundir os breakpoints. A home foi testada e passou nos três:

| Breakpoint | Divergência | Altura |
|---|---|---|
| Desktop 1440 | 0,45% | 7626 → 7626 |
| Tablet 1000 | 0,27% | 8361 → 8361 |
| Mobile 390 | 0,03% | 8807 → 8807 |

O truque é `display: contents` no invólucro de cada árvore: ele some do
layout, então as regras do Framer continuam valendo como se os filhos fossem
diretos do `<body>`. O `<head>` é byte-idêntico entre os três breakpoints
(mesmo MD5), então entra uma vez só.

Breakpoints reais do Framer, extraídos do CSS dele:
- desktop `(min-width: 1200px)`
- tablet `(min-width: 810px) and (max-width: 1199.98px)`
- mobile `(max-width: 809.98px)`

**Tarefa:** aplicar `funde-breakpoints.mjs` às 14 páginas, passar pelo
`processa-framer.mjs`, e fazer o verificador passar nas três larguras.

---

## 6. Depois disso

1. **Interações.** Duas são mecânicas (menu de celular, scroll reveals — são
   5 elementos com `opacity: 0; transform: translateX(-150px)`). Duas exigem
   injetar conteúdo que o Framer buscava do CMS:
   - **Acordeão de serviços**: os painéis fechados não têm texto no DOM. Os 5
     textos já estão transcritos em `src/lib/conteudo.ts`.
   - **Carrossel de projetos**: só `CASA IP` está no DOM. Existem 4 projetos —
     o quarto é `COZINHA LA`, descoberto clicando a seta na referência, e não
     tem página no clone.
2. **Formulário** → Brevo. O `action` aponta para `/api/contato`, que ainda
   não existe. Honeypot e rate limit já previstos.
3. **Sitemap** — o do Astro não gera mais nada, porque não há páginas em
   `src/pages/`. Precisa sair do pipeline.
4. **GA4 e Clarity** — as variáveis existem no `.env`, falta injetar.
5. **Lançamento** — DNS no registro.br, 301 das URLs antigas, Search Console,
   e cortar o Framer.
6. **CMS** — Supabase. As páginas de artigo compartilham um molde; a região
   de conteúdo vira slot.

---

## 7. Riscos com prazo

**A assinatura do Framer vence em breve.** Enquanto ela viver, duas coisas
precisam sair de lá, e as duas são insubstituíveis:

1. **Os CSV do CMS** (Plugins → CMS Export). São ~26 artigos; o clone só tem 5.
   Salvar em `_importar/` e rodar `importa-framer.mjs`. **Ainda não foi feito.**
2. **As capturas por breakpoint** (`captura-breakpoints.mjs`). Sem o site no ar
   não há como obter o DOM de celular. **✅ FEITO E VERIFICADO** — 42/42
   capturas (14 páginas × 3 breakpoints) em `_capturas/`, versionadas no git,
   nenhuma truncada. Este risco está neutralizado: mesmo que o Framer caia
   amanhã, o material para reconstruir o site inteiro já está no repositório.

Se o acesso cair antes disso, sobra engenharia reversa dos `.framercms` do
clone, com perda de formatação.

---

## 8. Credenciais

Tudo em `.env` (ignorado pelo git). `.env.example` é o formulário em branco.

**Preenchidas:** `GH_TOKEN`, `GITHUB_USUARIO` (arqisabellapires),
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DATABASE_PASSWORD`.

**Faltam:** `BREVO_API_KEY`, `BREVO_DESTINO_EMAIL`, `PUBLIC_GA4_ID`,
`PUBLIC_CLARITY_ID`.

O git não tem credential helper configurado. Para dar push:
```bash
set -a && . ./.env && set +a
git -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' push
```

> **Regra aprendida do jeito difícil:** o Gabriel já colou um token real no
> `.env.example`, que é versionado, e eu commitei sem reauditar. Foi preciso
> reescrever o histórico. **Audite o conteúdo de todo arquivo versionado antes
> de cada commit**, não só antes do push.

---

## 9. Conteúdo já resgatado

- `src/lib/conteudo.ts` — textos transcritos do site atual, sem reescrita:
  os 5 serviços com 3 parágrafos cada, os números da home
  (2024 / +32 / +10 / 100%), e os links do rodapé.
- `_referencia/` — o clone completo do Framer (fora do git, 93 MB).
- `_capturas/` — capturas por breakpoint do site vivo.

O Gabriel dirige as melhorias de texto. **Não invente copy.** Se faltar texto,
extraia da referência ou pergunte.

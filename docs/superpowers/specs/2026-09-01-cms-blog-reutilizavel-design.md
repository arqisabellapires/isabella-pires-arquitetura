# CMS de blog reutilizável — painel próprio, Supabase, site continua estático

Spec de design do sub-projeto da Fase 4 de
[2026-09-01-reconstrucao-astro-design.md](2026-09-01-reconstrucao-astro-design.md).
Aprovado pelo Gabriel em 01/09/2026 (opção **B**: a cliente loga, escreve,
sobe capa e publica).

Sem datas. Ordem por dependência; cada fase com portão de saída.

---

## 1. Objetivo

Dois clientes, na ordem:

1. **O Gabriel, nos próximos sites.** Este é o primeiro de vários sites com
   blog. O CMS tem que ser um **módulo** que se instala em outro projeto Astro
   copiando uma pasta, rodando as migrations e preenchendo variáveis de
   ambiente. O site da Isabella é o primeiro consumidor, não o dono.
2. **A Isabella.** Loga, cria artigo, escreve com formatação, sobe a capa,
   preenche categoria e SEO, vê preview, publica. Em minutos o site
   público reflete. Sem saber o que é git, markdown ou build.

Restrições:

- **O site público continua estático.** Nada de renderizar artigo sob
  demanda; publicar dispara rebuild. Performance e SEO da spec principal
  não podem regredir por causa do CMS.
- **Custo zero recorrente** no plano gratuito do Supabase e da Vercel, para um
  blog de dezenas de posts e um editor.
- **Manutenção mínima**: poucas dependências, nenhuma que exija upgrade
  frequente. Quebrar o painel não pode derrubar o site.
- **Fronteira limpa**: o pacote não sabe como o site renderiza artigo; o site
  não sabe onde o artigo está guardado. A costura é o **loader** do Content
  Layer do Astro, que já existe como ponto de troca em `src/content.config.ts`.

---

## 2. Arquitetura

```
┌──────────────────────────────┐        ┌──────────────────────────────┐
│ packages/cms-blog (pacote)   │        │ site (Astro do cliente)      │
│                              │        │                              │
│  supabase/migrations/*.sql   │        │  astro.config.mjs            │
│  src/loader.ts  ─────────────┼──────▶ │   integrations: [cmsBlog()]  │
│  src/integration.ts          │        │  content.config.ts           │
│    injeta /admin/*           │        │   artigos: loader: cmsBlog() │
│    injeta /api/cms/*         │        │  pages/artigos/[slug].astro  │
│    middleware de auth        │        │   (renderização é do site)   │
│  src/admin/  (páginas+UI)    │        │                              │
│  src/lib/    (supabase, seo) │        │  .env: 4 variáveis           │
└──────────────────────────────┘        └──────────────────────────────┘
              │                                        ▲
              ▼                                        │ build
       Supabase (Postgres + Auth + Storage)     Vercel Deploy Hook
              ▲                                        ▲
              │ escreve                                │ POST ao publicar
       Isabella no /admin ─────────────────────────────┘
```

### 2.1. Pacote `packages/cms-blog`

Workspace npm dentro deste repositório (`"workspaces": ["packages/*"]`).
Quando estiver estável, vira repositório próprio e entra por versão; até lá
o workspace evita publicar cedo.

| Parte | Responsabilidade |
|---|---|
| `supabase/migrations/` | Schema, RLS, buckets, funções. Idempotente; versionado. |
| `src/loader.ts` | Content Layer loader: lê `artigos` publicados do Supabase e entrega no **mesmo schema** que o `glob()` entrega hoje (`titulo`, `resumo`, `capa`, `capaAlt`, `publicadoEm`, `categoria`, `tags`, `seoTitulo`, `seoDescricao`, `slugAntigo`, corpo em HTML). O site não muda uma linha das páginas ao trocar de `glob()` para ele. |
| `src/integration.ts` | Astro integration: `injectRoute` para `/admin/*` e `/api/cms/*` (todas `prerender = false`), middleware que exige sessão em `/admin` e `/api/cms`, `vite.define` das variáveis públicas. Confirmar assinaturas na doc da versão instalada do Astro. |
| `src/admin/` | Páginas do painel (Astro + um mínimo de client script). |
| `src/lib/supabase.ts` | Clientes: anon (leitura pública) e service role (só no servidor). |
| `src/lib/seo.ts` | Regras editoriais: tamanho de title/description, slug, checklist local. |
| `src/lib/deploy.ts` | Dispara o Deploy Hook e registra em `publicacoes`. |
| `README.md` | "Como instalar em outro site" (§6). |

O pacote **não** contém componente de renderização de artigo. Cada site
renderiza do seu jeito; o pacote garante os dados e o painel.

### 2.2. Dados (Supabase / Postgres)

```sql
categorias   (id, slug unique, nome, descricao, ordem)
autores      (id → auth.users.id, nome, bio, avatar_url, papel: 'editor' | 'admin')
artigos      (id, slug unique, titulo, resumo, conteudo_html, conteudo_texto,
              capa_path, capa_alt, categoria_id → categorias, tags text[],
              autor_id → autores, publicado bool, publicado_em timestamptz,
              atualizado_em timestamptz, seo_titulo, seo_descricao,
              slug_antigo, destaque bool, criado_em)
publicacoes  (id, artigo_id, autor_id, disparado_em, deploy_status, deploy_url)
```

- `conteudo_html` é o que o editor produz; `conteudo_texto` é derivado (para
  resumo automático e busca). Os 25 artigos atuais já são HTML dentro do
  markdown — a migração é direta.
- Storage: bucket `blog` com `capas/<artigo-id>/<nome>` e
  `corpo/<artigo-id>/<nome>`. Público para leitura; escrita só autenticado.
- RLS:
  - `anon`: `select` em `artigos where publicado`, `categorias`, `autores`
    (campos públicos).
  - `authenticated` com linha em `autores`: `insert/update/delete` em
    `artigos` e `categorias`; `admin` também em `autores`.
  - `service_role` só no build (loader) e nas rotas de API do painel.
- Slug: gerado do título (ASCII, hífens), editável, único; mudar slug de
  artigo publicado grava `slug_antigo` automaticamente para o 301.
- `publicado_em` no futuro = agendado: o loader só entrega `publicado_em <=
  now()`; um cron da Vercel (ou GitHub Actions) dispara rebuild diário para
  materializar agendados. É o único "agendamento" desta versão.

### 2.3. Autenticação

- Supabase Auth, e-mail + senha, com "esqueci a senha". Sem cadastro aberto:
  `admin` convida por e-mail (função no painel que chama `inviteUserByEmail`
  com service role) e cria a linha em `autores`.
- Sessão via cookies `httpOnly` gerenciados no servidor (helper SSR do
  Supabase para a versão instalada; confirmar nome do pacote na doc).
- Middleware: `/admin/*` e `/api/cms/*` sem sessão → `/admin/entrar`.
- Sem OAuth nesta versão. Google login é melhoria futura se a cliente pedir.

### 2.4. Painel `/admin`

Rotas, todas sob demanda:

| Rota | O que faz |
|---|---|
| `/admin/entrar` | Login, recuperação de senha |
| `/admin` | Lista de artigos: rascunhos, publicados, agendados; busca; ação "novo" |
| `/admin/artigos/novo`, `/admin/artigos/[id]` | Editor (§2.5) |
| `/admin/artigos/[id]/preview` | Renderiza o artigo **com os componentes do site** (o site registra o componente de preview na integration) — ela vê exatamente como vai ficar |
| `/admin/categorias` | CRUD simples |
| `/admin/autores` | Só `admin`: convidar, remover |
| `/admin/publicacoes` | Histórico de deploys com status |
| `/api/cms/upload` | Recebe imagem, valida tipo/tamanho, redimensiona (max 2400 px, `sharp`), grava no Storage, devolve URL |
| `/api/cms/publicar` | Marca publicado, dispara Deploy Hook, grava em `publicacoes` |
| `/api/cms/deploy-status` | Consulta a API da Vercel para o status do último deploy |

UI: Astro + CSS próprio do pacote (não usa os tokens do site — o painel é
o mesmo em todos os clientes), client script mínimo. Sem framework de UI.
Se o editor rich text exigir React/Vue para o TipTap, é uma ilha isolada só
na página do editor.

### 2.5. Editor

- **TipTap** (ProseMirror), extensões: heading (h2/h3 só — h1 é o título),
  bold, italic, link, listas, blockquote, imagem (upload via
  `/api/cms/upload`), separador. Saída HTML.
- Campos ao lado: título, slug (auto, editável), resumo (contador 300),
  capa (upload + **alt obrigatório**), categoria, tags, autor, data de
  publicação, destaque, `seoTitulo` (contador 60), `seoDescricao`
  (contador 160).
- **Checklist editorial** visível, não bloqueante, de `seo.ts`:
  - título < 70 caracteres, description 120–160, um h2 pelo menos, capa com
    alt, resumo preenchido;
  - **local**: "o texto cita Maringá ou região?" — porque a spec principal
    conclui que busca local é a única que este site ganha;
  - link interno para pelo menos um artigo ou serviço.
- Salvamento automático de rascunho (debounce, `PATCH`), indicador
  "salvo às hh:mm".
- Botões: **Salvar rascunho** · **Preview** · **Publicar** (confirma e mostra
  "site atualizando, ~2 min" com o status vindo de `/api/cms/deploy-status`).

### 2.6. Fluxo de publicação

1. Isabella clica Publicar → `/api/cms/publicar`.
2. `publicado = true`, `publicado_em = now()` (ou a data escolhida).
3. `POST` no Deploy Hook da Vercel (`VERCEL_DEPLOY_HOOK_URL`).
4. Build do site: loader lê Supabase, gera `/artigos/<slug>/`, listagem,
   categorias, sitemap, JSON-LD `Article`.
5. Painel mostra status até "publicado" com link.

Falha de deploy não desfaz a publicação no banco; o painel mostra o erro e
oferece "tentar de novo". O site anterior continua no ar (deploy atômico da
Vercel).

### 2.7. Segurança

- Service role **nunca** no cliente; só em rotas de API e no build.
- Upload: aceita `image/jpeg|png|webp|avif`, ≤ 10 MB, redimensiona e
  re-codifica (elimina metadados e payloads escondidos).
- HTML do editor é sanitizado **no render** do site (allowlist de tags e
  atributos), não só no editor.
- Rate limit nas rotas de API por sessão; CSRF por `SameSite=Lax` +
  verificação de origem nas mutações.
- RLS é a última linha: mesmo com bug no painel, `anon` não escreve.
- Convite só por `admin`; a Isabella é `admin` do site dela; o Gabriel é
  `admin` também, por conta própria.

---

## 3. Fases

### Fase 4.0 — Contrato

- [ ] Fixar o schema de saída do loader = schema atual de `artigos` em
      `content.config.ts` (com `conteudo` HTML em vez de markdown).
- [ ] `packages/cms-blog` criado no workspace, com `README` esqueleto e as
      migrations.
- [ ] Projeto Supabase existente (`PUBLIC_SUPABASE_URL` já está no `.env`)
      recebe as migrations via CLI; ambiente local com `supabase start`
      para testes.

**Portão:** `supabase db reset` sobe o schema do zero sem erro; RLS testada
com `anon` (não escreve) e `authenticated` (escreve só o seu).

### Fase 4.1 — Loader e migração dos 25 artigos

- [ ] `loader.ts` lendo Supabase; `content.config.ts` troca `glob()` por ele
      atrás de uma variável (`CMS_FONTE=supabase|arquivos`) para poder
      voltar.
- [ ] `tools/importa-para-supabase.mjs`: 25 markdowns → linhas; capas e
      imagens do corpo → Storage; reescreve `src` no HTML.
- [ ] Build do site com `CMS_FONTE=supabase` gera as mesmas 25 páginas;
      `verifica-secao` nos 5 artigos capturados continua verde.

**Portão:** diff zero (ou só URLs de imagem) entre o HTML gerado com
arquivos e com Supabase, nas 25 páginas.

### Fase 4.2 — Auth e painel mínimo

- [ ] Integration com `injectRoute` e middleware.
- [ ] Login, lista, editor com campos, upload, salvar rascunho.
- [ ] Preview com os componentes do site.

**Portão:** teste Playwright: entrar → criar artigo → subir capa → salvar →
preview mostra o artigo com o layout do site → sair; `anon` recebe 302 em
`/admin`.

### Fase 4.3 — Publicar e deploy

- [ ] Deploy Hook criado na Vercel (conta da Isabella); `/api/cms/publicar`,
      `/api/cms/deploy-status`, tela de publicações.
- [ ] Agendamento pelo cron diário.

**Portão:** publicar no painel → site público mostra o artigo novo, listagem,
categoria, sitemap e JSON-LD, sem intervenção manual.

### Fase 4.4 — Editorial e entrega

- [ ] Checklist editorial e contadores.
- [ ] Categorias e autores.
- [ ] `README` de reuso (§6) testado **instalando o pacote num Astro vazio**
      e chegando a um artigo publicado. É o teste de que o objetivo 1 de §1
      foi atingido.
- [ ] Guia de uso de uma página para a Isabella (`docs/painel-do-blog.md`),
      com capturas de tela.

**Portão:** o Astro vazio publica; a Isabella cria e publica um artigo sem
ajuda.

---

## 4. Testes

| Camada | Como |
|---|---|
| Migrations/RLS | `supabase start` + script SQL que tenta cada operação com cada papel e espera permitido/negado |
| Loader | Teste unitário contra o Supabase local semeado com 3 artigos (1 rascunho, 1 agendado, 1 publicado) — só o publicado sai |
| API | Testes de rota com sessão válida/inválida, upload inválido, publicar sem permissão |
| Painel | Playwright, fluxo completo de §3 (4.2 e 4.3) |
| Site | Os portões da spec principal continuam valendo: o CMS não pode fazer Lighthouse cair nem `verifica-secao` sinalizar |

---

## 5. Riscos

| Risco | Mitigação |
|---|---|
| Supabase gratuito pausa projeto inativo | Cron diário de rebuild já toca o banco; documentar no README |
| Deploy Hook vaza (é uma URL) | Só no servidor; rotacionar pela Vercel se vazar; o hook só rebuilda, não lê nada |
| TipTap puxa React e engorda o painel | Ilha só na página do editor; o site público não carrega nada disso |
| Painel e site na mesma app: bug no painel derruba o build | Rotas do painel são sob demanda; erro em runtime delas não afeta as páginas estáticas. Erro de build do pacote é pego pelo CI antes do deploy |
| Rebuild de 1–2 min frustra a editora | Status visível no painel; preview instantâneo cobre a necessidade de "ver antes" |
| Reuso não é real (acoplou ao site sem perceber) | O portão da Fase 4.4 é instalar num Astro vazio; se falhar, o pacote não está pronto |

---

## 6. Receita de reuso (o que o README promete)

1. `npm i` do pacote (workspace ou git URL).
2. `astro.config.mjs`: `integrations: [cmsBlog({ preview: './src/components/ArtigoPreview.astro' })]`.
3. `content.config.ts`: `artigos: defineCollection({ loader: cmsBlogLoader(), schema: cmsBlogSchema })`.
4. Supabase: projeto novo, `supabase db push` com as migrations do pacote,
   bucket `blog` criado pela migration.
5. Variáveis: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK_URL`.
6. Primeiro admin: `npx cms-blog convidar <email>`.
7. Páginas `/artigos/*` são do site: o pacote entrega dados, o site desenha.

Se qualquer passo exigir mais que isso, é bug do pacote.

---

## 7. Fora de escopo

- Comentários, multi-idioma, múltiplos blogs por site, revisão/aprovação em
  fluxo, biblioteca de mídia com busca, OAuth, editor de páginas (só artigos).
- Migrar projetos (`/projetos`) para o CMS: os 4 cases ficam em markdown; se
  a Isabella quiser editar projeto, é uma segunda coleção no mesmo pacote,
  spec à parte.

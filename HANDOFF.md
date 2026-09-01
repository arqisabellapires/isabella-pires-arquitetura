# Handoff — Isabella Pires Arquitetura

Migração do site do Framer para código próprio. Este documento é o estado
completo do projeto. Leia antes de tocar em qualquer coisa.

Último commit desta rodada: `029ce76`.

---

## 1. O que é o projeto

A cliente (Isabella Pires, arquiteta) tinha o site no Framer. Estamos
substituindo por site próprio na Vercel, na conta dela. Objetivo declarado
pelo Gabriel: **SEO e beleza**. O site novo tem que ficar **idêntico** ao
atual — ele dirige as melhorias depois, uma a uma.

Fases: resgate do conteúdo → site 1:1 no ar → CMS de blog no Supabase →
produção de ~40 posts.

**O Gabriel dirige o texto. Não invente copy.** Se faltar texto, extraia da
referência ou pergunte.

---

## 2. Como rodar

**A origem do Framer não é o domínio próprio.** O domínio já aponta para a
Vercel e serve o nosso site; capturar de lá traz a migração de volta como se
fosse referência. Use sempre:

```bash
export FRAMER_BASE=https://authentic-learning-761482.framer.app

node tools/captura-breakpoints.mjs      # só enquanto o Framer existir
node tools/audita-capturas.mjs          # confere que vieram do Framer
node tools/funde-breakpoints.mjs
node tools/baixa-variantes.mjs          # só enquanto o Framer existir
node tools/processa-framer.mjs
node tools/otimiza-imagens.mjs
node tools/verifica-fidelidade.mjs      # o portão, nos 3 breakpoints
```

Diagnóstico quando o portão reclamar (dá a resposta em texto, sem abrir os
mapas de imagem):

```bash
node tools/diagnostica-diferenca.mjs /servicos/ mobile
```

### Ferramentas

| Script | O que faz |
|---|---|
| `paginas.mjs` | **Tabela única** das 14 páginas e dos 3 breakpoints |
| `captura-breakpoints.mjs` | Captura 14 páginas × 3 breakpoints do Framer vivo |
| `audita-capturas.mjs` | Confere que toda captura é do Framer, não nossa |
| `funde-breakpoints.mjs` | Funde as 3 capturas num HTML com media queries |
| `baixa-variantes.mjs` | Baixa variantes de imagem que só celular/tablet pedem |
| `baixa-runtime.mjs` | Puxa o runtime JS do Framer + source maps |
| `extrai-fontes.mjs` | Desempacota os source maps em código legível |
| `extrai-variantes.mjs` | Gera `public/variantes.json` (máquinas de estado) |
| `processa-framer.mjs` | Tira runtime, reescreve assets e links → `public/` |
| `otimiza-imagens.mjs` | Converte para WebP e reescreve as referências |
| `verifica-fidelidade.mjs` | **O portão.** Compara pixel a pixel |
| `diagnostica-diferenca.mjs` | Diz *onde* diverge, em texto |
| `servidor.mjs` | Servidor estático em porta livre, com checagem |
| `importa-framer.mjs` | Converte CSV do CMS do Framer em markdown |

---

## 3. Estado atual

### Verificado

- **Portão: 38/42.** Todas as alturas batem exatamente.

  | Breakpoint | Passam |
  |---|---|
  | desktop 1440 | 13/14 |
  | tablet 1000 | 12/14 |
  | mobile 390 | 13/14 |

  Falha `/artigos/` nos três, e `o-que-muda-na-arquitetura-residencial-em-2026`
  no tablet em 0,55% (passa nas outras larguras — ruído de limite).

- **42/42 capturas** da origem real do Framer, auditadas.
- **Imagens em WebP**: 142,8 MB → 60,5 MB (−58%).
- **25 artigos** do CMS em `src/content/artigos/`.
- **Fontes self-hospedadas** (3 origens: Google, assets do Framer, Fontshare).
- No ar: `www.isabellapiresarquitetura.com.br` (Vercel).

### Interações que funcionam

Em `public/interacoes.js`, reimplementação própria:

| Interação | Como |
|---|---|
| Scroll reveals | Mola por oscilador harmônico amortecido |
| Menu de celular | Troca de variante: cabeçalho 59px → 223px |
| Hover do card de projeto | Troca de variante: 557px → 367px |

**O mecanismo, que é o achado que destrava o resto:** o CSS de *todas* as
variantes de um componente vem servido na página, inclusive das que o HTML
não usa — são os estados de hover e aberto esperando alguém aplicar.
`extrai-variantes.mjs` lê `variantClassNames` e `humanReadableVariantMap` do
fonte do Framer e pareia repouso → resposta pelos nomes que a arquiteta deu
("Casa IP Desktop - Hover"). Reviver a interação é trocar a classe.

**Trava obrigatória:** o runtime testa cada par antes de ligar handler —
troca a classe, mede, desfaz, descarta o que não muda nada. Sem isso o
cabeçalho, que tem par `Open/Closed` inerte, receberia handler de clique com
`preventDefault` e **mataria a navegação do site inteiro**. E nunca chamar
`preventDefault` em clique que caiu num `a[href]`.

### Arquitetura, para não se perder

O site no ar **não é Astro renderizando páginas**. É o HTML do Framer
processado, servido estático de `public/`. `src/pages/` só tem as rotas de
API. O Astro está ali para a fase do CMS.

```
public/           HTML processado do Framer — é isto que está no ar
src/pages/api/    contato.ts, newsletter.ts (Brevo)
src/content/      25 artigos em markdown, ainda sem página que os consuma
src/components/   da reconstrução manual abandonada — ver seção 6
_capturas/        42 capturas + fundido.html (versionado)
_fonte-framer/    fonte do Framer desempacotado (FORA do git)
_capturas/_runtime/ runtime do Framer (FORA do git)
_referencia/      clone antigo, imagens e fontes em disco (FORA do git)
_importar/        Blog.csv e imagens-para-baixar.txt (FORA do git)
```

---

## 4. O que falta

Em ordem de dependência: os itens 1 e 2 destravam vários outros.

### 4.1. Conteúdo que não está no DOM — **faça primeiro**

O Framer buscava do CMS em tempo de execução, então o HTML capturado não tem.
Sem isso, carrossel e acordeão não têm o que mostrar.

- [ ] **Exportar a coleção de projetos** no editor do Framer
      (Plugins → CMS Export). Foi assim que os 25 artigos vieram. Salvar em
      `_importar/` e rodar `node tools/importa-framer.mjs _importar/Projetos.csv projetos`.
      São 4: `Casa IP`, `AP MM`, `STUDIO`, `COZINHA LA` — esta última não tem
      página no clone e é a que falta no carrossel.
- [ ] **Baixar as 25 capas dos artigos.** URLs em
      `_importar/imagens-para-baixar.txt`. **Bloqueia o build** assim que
      existir uma página consumindo a coleção: o schema usa `image()` e quebra
      se o arquivo não existir. Hoje o build passa só porque nada consome.
- [ ] **Textos dos 5 painéis do acordeão** já estão em `src/lib/conteudo.ts`,
      transcritos. Falta injetar no DOM.

### 4.2. Carrossel de projetos — rolar entre os cases

Hoje só `CASA IP` aparece. O mapa de variantes confirma os 4 estados e o
componente controlador.

- Controlador: `a6Nde7smU.js` — variantes `Casa IP`, `AP MM`, `STUDIO`, `COZINHA LA`
- Cards: `Qv_x9EZNH.js` — 16 variantes (projeto × breakpoint × hover/aberto)
- Movimento: `spring damping 30, stiffness 400, mass 1`
- Em `/projetos/` os 4 cards **estão no DOM** (`Casa IP - Desktop`,
  `AP MM - Desktop - Hover`, `Studio Desktop Hover`, `Cozinha LA Desktop Hover`).
  Na home o carrossel (`carousels-isa`) só tem um.

Caminho: usar o mesmo mecanismo de troca de variante, com as setas trocando
o estado do controlador. O conteúdo dos outros 3 sai do item 4.1.

### 4.3. Acordeão de serviços

Trocar a classe **não muda nada** — testado. O painel aberto não tem conteúdo
no DOM, então não há o que expandir. Precisa injetar os textos de
`src/lib/conteudo.ts` primeiro e só então ligar o toggle.

- Componentes: `n8yL1JHdr.js`, `i15JnwUan.js`, `f4n4OEmqR.js` (`Open`/`Closed`)
- Serviços nomeados em `iCmFNLdck.js`: `Arquitetura Residencial`,
  `Arquitetura Comercial`, `Design de Interiores`
- Movimento: `spring bounce .2 duration .4`

### 4.4. Motion no site todo

O que já foi medido na origem certa, para não refazer:

- **Hover só existe no card de projeto.** 2/18 em `/projetos/`, 0/8 na home,
  0/20 em `/serviços/`. Links, botões e imagens **não têm hover** no original.
  Não invente o que não existe.
- Falta varrer as 14 páginas × 3 breakpoints com o mesmo método para achar o
  que ainda não foi coberto. O que existe hoje é amostragem, não varredura.
- **Melhoria pendente na mola:** hoje as trocas de variante usam
  `cubic-bezier(.34,1.2,.64,1)`, que é aproximação. CSS `linear()` suporta
  mola de verdade desde 2023 (~87% de cobertura) e expressa múltiplos
  bounces, que bezier não consegue. Gerar os pontos com integração numérica
  (já existe `curvaDeMola()` em `interacoes.js`) e trocar.

### 4.5. Páginas em Astro

Nada disso existe ainda — `src/pages/` só tem as APIs. É o que transforma o
site estático em site com CMS.

- [ ] `/artigos/` — listagem. **Não é reproduzível estaticamente**: a
      referência mede altura diferente a cada carregamento (2778, 5073, 5532 px)
      porque busca do CMS em runtime. É a falha de 1% no portão. Vira template.
- [ ] `/artigos/[slug]` — as páginas de artigo compartilham um molde; a região
      de conteúdo vira slot. Os 25 markdowns já estão prontos para consumir.
- [ ] `/projetos/` e `/projetos/[slug]` — depende do item 4.1.
- [ ] `/sobre-nos/`, `/contato/`, `/servicos/` — hoje são HTML estático fiel.
      Só precisam virar Astro quando houver motivo (conteúdo dinâmico ou
      manutenção). Se não houver, deixe estático: já passam no portão.

### 4.6. Formulário → Brevo

Código pronto e testado localmente. **Travado por três coisas fora do código:**

1. **IPs autorizados na Brevo.** A chave é válida mas a conta recusa com 401
   citando o IP. As funções da Vercel saem por IP dinâmico e não são
   whitelistáveis no Hobby. Tem que ser **desligado** em
   `app.brevo.com/security/authorised_ips`. Enquanto isso não acontece, nada
   pode ser verificado contra a API real.
2. **`BREVO_DESTINO_EMAIL` vazio.** Sem ele o endpoint devolve 502. Decisão do
   Gabriel: para qual caixa vão os leads.
3. **Domínio não autenticado.** O remetente é
   `contato@isabellapiresarquitetura.com.br`, mas a zona não tem DKIM nem
   DMARC (nem MX — esse e-mail não existe como caixa). São 3 TXT no
   registro.br; os valores saem em `GET /v3/senders/domains` assim que o
   item 1 for resolvido.
4. **`BREVO_LISTA_NEWSLETTER_ID`** — criar a lista na Brevo e pegar o id.

Verificado local (`astro dev` + curl): isca → 200 silencioso; campo faltando
→ 422; e-mail inválido → 422; sem JS → 303 com `?envio=`; 6º envio válido em
10 min → 429.

**Decisão:** o limite por IP roda **depois** da validação, para não trancar
por 10 min quem só errou o e-mail. É um `Map` em memória, por instância —
segura repetição de um visitante, não ataque distribuído. Se não bastar, o
próximo passo é KV/Upstash, não afinar os números.

### 4.7. Lançamento

- [ ] **Sitemap.** O do Astro não gera nada porque não há páginas em
      `src/pages/`. Hoje `/sitemap-index.xml` responde 404 no domínio. Precisa
      sair do pipeline ou ganhar páginas.
- [ ] **GA4 e Clarity** — variáveis existem no `.env`, falta injetar.
- [ ] **301 das URLs antigas** (que tinham acento). O mapa está em
      `tools/paginas.mjs`; os artigos guardam `slugAntigo` no frontmatter.
- [ ] **Search Console** e cortar o Framer.

### 4.8. Dívidas menores

- [ ] `/artigos/` fica ~1% acima do limite no portão. Já foram descartados:
      layout (DOM idêntico), imagens (mesmos 24 arquivos nas mesmas posições)
      e codec (AVIF vs PNG vale só 0,19%, medido). Causa real desconhecida.
      Como a página vira template, foi deixada assim de propósito.
- [ ] `src/components/Formulario.astro` é resquício da reconstrução manual
      abandonada e não é usado por nada. Apagar quando alguém confirmar.
- [ ] `.env` linha 6 tem valor sem aspas: `set -a && . ./.env` cospe
      `Isabella: command not found`.

---

## 5. Decisões fechadas

Não reabrir sem falar com o Gabriel.

| Tema | Decisão |
|---|---|
| Estratégia | **Processar o HTML renderizado do Framer**, não reconstruir à mão |
| Responsivo | Capturar os 3 breakpoints e empilhar no mesmo HTML |
| Fidelidade | Portão de pixel: falha acima de 0,5% de divergência |
| Hospedagem | Vercel Hobby — risco aceito |
| Versionamento | GitHub, repositório **público** |
| Runtime do Framer | **Fora do git.** Código proprietário deles, repo público |
| E-mail | Brevo (300/dia grátis); o log da Brevo é o arquivo de leads |
| Banco/CMS | Supabase (fase posterior) |
| Analytics | GA4 + Microsoft Clarity |
| URLs | ASCII, com 301 das antigas |

**Por que não reconstruir à mão:** foi tentado. A home reconstruída divergia
em 14 pontos (títulos inventados, seções omitidas, números errados). Não
converge. Ver `cb20c52` e `821f036`.

**Por que processar o HTML funciona:** o HTML renderizado do Framer é
pixel-idêntico sem nenhum JavaScript (0,00%, 90 pixels em 3,5 milhões). É
também o que a indústria faz — os serviços pagos vendem exatamente isso.
Pesquisado: **nenhuma ferramenta, paga ou aberta, reimplementa as
interações.** Todas só capturam DOM. Não vale comprar.

---

## 6. Armadilhas que já custaram tempo

1. **Confirme a origem antes de medir.** Duas conclusões erradas saíram de
   sondar "o site vivo" sem checar quem responde no domínio — que hoje é o
   nosso próprio site. Ou confirme a origem, ou leia o fonte em
   `_fonte-framer/`, que não depende de rede.
2. **Servidores zumbis.** `python3 -m http.server` de sessão anterior segurando
   as portas: os do verificador não sobem, morrem calados, a referência vem
   404 e toda página "diverge" 100% com altura de viewport. `servidor.mjs`
   procura porta livre e confirma que serve. Se vir divergência ~100% com
   altura igual à viewport, é isto.
3. **Captura falsa não denuncia nada.** O HTML é plausível e a página compara a
   migração consigo mesma e aprova. Rode `audita-capturas.mjs`.
4. O clone salva variantes de `srcset` como `base@query`, **não** `base?query`.
5. O `&` no HTML vem como `&amp;` — precisa decodificar para achar o arquivo em
   disco. Sem isso o fallback pega a variante errada: imagem certa, resolução
   errada. Esse bug sozinho valia 26 pontos percentuais.
6. As fontes vêm de **três** origens distintas.
7. `(?is)` é sintaxe de Python. Em JavaScript são flags: `/regex/gis`.
8. A CDN do Framer serve **AVIF** para navegador e **PNG/JPEG** para `fetch`
   sem `Accept`. Vale 0,19% de divergência — não é a causa de nada maior.
9. As classes `framer-v-*` não são estáveis entre publicações do Framer. Se
   recapturar depois de a arquiteta republicar, **regere `variantes.json`**.

> **Regra aprendida do jeito difícil:** o Gabriel já colou um token real no
> `.env.example`, que é versionado, e eu commitei sem reauditar. Foi preciso
> reescrever o histórico. **Audite o conteúdo de todo arquivo versionado antes
> de cada commit**, não só antes do push.

---

## 7. Risco com prazo

**A assinatura do Framer vence.** Enquanto ela viver, tudo que for
insubstituível precisa sair de lá.

- ✅ **Capturas por breakpoint** — 42/42 da origem certa, versionadas.
- ✅ **CSV do blog** — 25 artigos importados.
- ✅ **Runtime e source maps** — baixados, mas **fora do git**. Se precisar
  sobreviver ao vencimento, faça backup fora do repo ou torne o repo privado.
- ❌ **CSV de projetos** — ainda não exportado. É o item 4.1.
- ❌ **Capas dos 25 artigos** — ainda não baixadas.

---

## 8. Credenciais

Tudo em `.env` (ignorado pelo git). `.env.example` é o formulário em branco.

**Preenchidas:** `GH_TOKEN`, `GITHUB_USUARIO` (arqisabellapires),
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DATABASE_PASSWORD`.

**Faltam:** `BREVO_DESTINO_EMAIL`, `BREVO_LISTA_NEWSLETTER_ID`,
`PUBLIC_GA4_ID`, `PUBLIC_CLARITY_ID`.

Na Vercel já estão (produção, preview e dev): `BREVO_API_KEY` (encrypted),
`BREVO_REMETENTE_EMAIL`, `BREVO_REMETENTE_NOME`. Variável nova só vale a
partir do próximo deploy.

O git não tem credential helper. Para dar push:

```bash
set -a && . ./.env && set +a
git -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' push
```

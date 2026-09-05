# Handoff — Isabella Pires Arquitetura

Migração do site do Framer para código próprio. Este documento é o estado
completo do projeto. Leia antes de tocar em qualquer coisa.

> **A ponte acabou em 03/09/2026.** O HTML processado do Framer que ficava em
> `public/` foi substituído, página por página, por rotas Astro — não existe
> mais. As Fases 0, 1 e 2 da spec estão fechadas.
>
> Desenho e fases em [docs/superpowers/specs/](docs/superpowers/specs/),
> resumo em [PLANO.md](PLANO.md). **Aviso de leitura:** as seções 3 e 4
> abaixo descreviam o estado da ponte e estão em boa parte obsoletas; o que
> vale é a seção 0. Onde conflitarem, a seção 0 e a spec mandam.

> **Novo por aqui?** Leia
> [docs/ENTENDA-O-PROJETO.md](docs/ENTENDA-O-PROJETO.md) primeiro: explica o
> que era o Framer, o que é Astro, por que a primeira tentativa falhou, o que
> ainda está diferente do original (as animações, principalmente) e o que se
> propõe a seguir. Este HANDOFF é o estado técnico; aquele é o porquê.

## 0. Onde a execução parou — leia isto primeiro

Estado em 03/09/2026, depois de 19 commits, todos na `main` e pushados.
**As Fases 0, 1 e 2 fecharam. O site inteiro é Astro; não existe mais um
único `.html` do Framer no ar.**

### O que mudou nesta rodada, em número

| | Antes (Framer processado) | Agora (Astro) |
|---|---|---|
| Páginas | 15 HTML estáticos | **39 rotas** |
| HTML por página | 250–630 KB | **17 KB de média, 36 no pior caso** |
| JavaScript | 3 DOMs + runtime | **4 KB no site inteiro** |
| `<h1>` | 0 em 10 das 15 páginas | **1 em todas as 39** |
| `<title>` | igual em 5 páginas | **único em todas** |
| JSON-LD | nenhum | **89 blocos, todos válidos** |
| `public/` | ~180 MB | **19 MB** (fontes, imagens de artigo, robots) |
| Artigos no ar | 5 (20 em 302) | **25, com 301 para o artigo real** |

### Portões, todos medidos

```bash
npx astro build                # 39 páginas
node tools/audita-paginas.mjs  # estrutura, metadados, a11y — passa
node tools/valida-tokens.mjs   # o CSS de tokens é válido no Chromium
```

`audita-paginas.mjs` é novo e substitui o `audita-lighthouse.mjs` que o
`package.json` citava e nunca existiu. Ele mede `<h1>` único,
title/description únicos no site, `lang`, canonical, `alt` em toda imagem,
hierarquia de heading sem salto e ausência de `framer-`. Foi testado contra
defeito injetado e reprova com saída 1.

**O que ele não mede, e por que:** Performance, LCP e CLS precisam do
Lighthouse, que não está instalado — instalar dependência grande é decisão
sua. Rode o PageSpeed Insights sobre o domínio depois do deploy, ou
`npm i -D lighthouse` se quiser no build.

### As quatro travas da Brevo caíram

O §4.6 listava o formulário como bloqueado por quatro coisas fora do código.
Fui conferir: **as quatro já estavam resolvidas** — você mexeu na Brevo desde
que aquilo foi escrito. A API responde 200, o destino e a lista (id 3) estão
preenchidos, e o domínio consta autenticado.

Então o formulário foi testado contra a API real, não em simulação: campo
faltando → 422, e-mail inválido → 422, isca preenchida → 200 silencioso,
**envio válido → 200 e e-mail entregue**, newsletter → 200, sem JavaScript →
303. O 403 das primeiras tentativas era a proteção CSRF do Astro recusando
POST sem `Origin` — comportamento correto.

### O que falta, em ordem

**Decisões suas, que eu não podia tomar:**

1. **Os `alt` das 20 imagens de projeto.** Estão vazios com `TODO(gabriel)`
   no frontmatter de `src/content/projetos/*.md`. Texto é seu; não inventei.
2. **Nomear os tokens.** `src/styles/tokens.derivados.css` tem os 517 valores
   medidos, com procedência em `_capturas/tokens-relatorio.json`. O
   `tokens.css` atual segue intacto. Quando decidir os nomes:
   `node tools/deriva-tokens.mjs --sobrescreve`.
   Vale olhar: `#6c757d` e `#212529` são cinzas do Bootstrap vindos de um
   widget e `Segoe UI` é degrau de fallback — provavelmente sujeira, não
   token.
3. **As três páginas de política** (Termos, Privacidade, Cookies). No Framer
   os links do rodapé apontavam para lugar nenhum; viraram texto, não link
   morto. Criar política jurídica não é trabalho de quem executa.
4. **`PUBLIC_GA4_ID` e `PUBLIC_CLARITY_ID`** não existem no `.env`. O
   `Base.astro` já injeta os dois quando as variáveis aparecerem.

**Externo, não é código:**

5. **Search Console** — criar a propriedade (conta da Isabella) e enviar
   `https://www.isabellapiresarquitetura.com.br/sitemap-index.xml`, que agora
   é gerado de verdade pelo `@astrojs/sitemap` com as 39 URLs.
6. **Perfil da Empresa no Google**, com site, telefone e categoria
   "Arquiteto". É o item de maior efeito para "arquitetura Maringá" e não
   depende de nós.

**Trabalho de código que sobrou:**

7. **Deploy e conferência no domínio.** Nada disto foi para produção nesta
   rodada — está tudo na `main`, buildando. Falta ver de pé.
8. **Comparação lado a lado.** A spec §5.3 diz que quem aprova é você
   olhando o `compara.html`, por seção e breakpoint. Eu **não posso aprovar
   no seu lugar**, então nenhuma página foi marcada como aceita — só como
   construída a partir das medidas e passando nos portões objetivos.
9. **Fases 4 e 5** — o CMS de blog (spec própria) e os 40 posts. Nem
   começaram.

### Lições de método

Da rodada das gravações: teste a rodada longa em pelo menos um caso que você
espera que **falhe**, antes de soltar.

Dos tokens: **quem verifica é o consumidor real, não os olhos.** Os três
defeitos do `deriva-tokens` não davam erro em lugar nenhum — CSS inválido é
descartado em silêncio. Foi abrir o arquivo no Chromium e perguntar "quantas
propriedades chegaram?" que revelou os três.

Desta rodada, uma nova e cara: **medida serve para geometria, não para
prosa.** O `medidas.json` guarda um elemento por caixa, então um `<p>` com
`<strong>` dentro vira três entradas e o texto do negrito some do parágrafo —
os projetos saíram com "a análise do e da relação", sem a palavra "terreno".
Pior: a home anima títulos **letra a letra**, cada uma num `<span>`, e os
quatro projetos chegaram a se chamar "I" porque o rodapé tem um "ISABELLA"
decorativo a 110px. Para texto, a fonte é o HTML da captura; a medida é para
caixa, fonte e cor.

E o corolário de sempre: portão que nunca foi visto falhando é decoração. O
`audita-paginas.mjs` e o `valida-tokens.mjs` foram os dois testados contra
defeito injetado antes de eu confiar neles.

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
| `paginas.mjs` | **Tabela única** das 15 páginas e dos 3 breakpoints |
| `captura-breakpoints.mjs` | Captura 15 páginas × 3 breakpoints do Framer vivo |
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
| `baixa-capas.mjs` | Baixa as capas do CMS para dentro da coleção do Astro |
| `baixa-imagens-do-corpo.mjs` | Traz as imagens de dentro dos artigos e reescreve as referências |
| `backup-framer.mjs` | Empacota as 5 pastas do Framer fora do git, com manifesto e sha256 |
| `grava-interacoes.mjs` | Grava as interações do Framer vivo em `.webm` (Fase 0) |
| `checa-gravacoes.mjs` | **Portão da Fase 0.** Abre cada vídeo e acusa gravação parada |
| `extrai-medidas.mjs` | Captura → `medidas.<bp>.json`; a especificação medida |
| `deriva-tokens.mjs` | Medidas → `tokens.derivados.css` + relatório de procedência |
| `valida-tokens.mjs` | **Portão dos tokens.** Confere no Chromium que o CSS é válido |
| `compara.mjs` | Lado a lado Framer × Astro, para o Gabriel aprovar |
| `verifica-secao.mjs` | Portão por seção, com as diferenças de medida em texto |
| `audita-paginas.mjs` | **Portão do site construído.** h1, title, alt, hierarquia, zero framer- |
| `extrai-projetos.mjs` | As 4 capturas de projeto viram a coleção `projetos` |

---

## 3. Estado atual

> **Obsoleta desde 03/09/2026.** Esta seção descreve o site estático
> processado, que não existe mais. Fica como registro do que foi medido na
> época. O estado corrente é a seção 0.

### Verificado

- **Portão: 41/45.** Todas as alturas batem exatamente.

  | Breakpoint | Passam |
  |---|---|
  | desktop 1440 | 14/15 |
  | tablet 1000 | 13/15 |
  | mobile 390 | 14/15 |

  Falha `/artigos/` nos três, e `o-que-muda-na-arquitetura-residencial-em-2026`
  no tablet em 0,55% (passa nas outras larguras — ruído de limite). São as
  **mesmas 4 falhas de sempre**: eram 38/42 com 14 páginas, e as 3 comparações
  novas de `cozinha-la` passaram todas (tablet 0,23%, mobile 0,12%).

- **45/45 capturas** da origem real do Framer, auditadas — inclui
  `/projetos/cozinha-la`, que faltava na tabela de páginas (ver 4.1).
- **Imagens em WebP**: 142,8 MB → 60,5 MB (−58%).
- **25 artigos** do CMS em `src/content/artigos/`, com as **25 capas** em
  `src/content/artigos/imagens/` (50 MB de originais; 21 JPG, 4 PNG).
  Verificado: página temporária consumindo `getCollection('artigos')` builda,
  as 25 `image()` resolvem. O bloqueio de build descrito em 4.1 acabou.
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
src/content/      25 artigos + 25 capas, ainda sem página que os consuma
src/components/   da reconstrução manual abandonada — ver seção 6
_capturas/        45 capturas + fundido.html (versionado)
_fonte-framer/    fonte do Framer desempacotado (FORA do git)
_capturas/_runtime/ runtime do Framer (FORA do git)
_referencia/      clone antigo, imagens e fontes em disco (FORA do git)
_importar/        Blog.csv e imagens-para-baixar.txt (FORA do git)
src/content/artigos/imagens/  as 25 capas, originais (DENTRO do git, 50 MB)
public/img-artigos/  19 imagens de dentro dos artigos, WebP (versionado)
```

---

## 4. O que falta

> **Quase toda obsoleta desde 03/09/2026:** o site estático foi substituído,
> então os itens que falavam dele não se aplicam mais. Sobrevivem como
> referência os fatos medidos sobre o Framer (§4.2, §4.3, §4.4) e as
> pendências externas (§4.7). O que falta de verdade está na seção 0.

Em ordem de dependência: os itens 1 e 2 destravam vários outros.

### 4.1. Conteúdo que não está no DOM — **faça primeiro**

O Framer buscava do CMS em tempo de execução, então o HTML capturado não tem.
Sem isso, carrossel e acordeão não têm o que mostrar.

- [x] **As 25 capas dos artigos** — baixadas com
      `node tools/baixa-capas.mjs _importar/Blog.csv artigos`.
      O par slug↔URL sai do CSV, não de `imagens-para-baixar.txt`, que é só um
      Set de URLs sem o slug ao lado. 4 das 25 são PNG e o `importa-framer.mjs`
      tinha escrito `.jpg` para todas: os frontmatters foram corrigidos para a
      extensão real, senão `image()` não resolve. **O bloqueio de build acabou** —
      verificado com uma página temporária consumindo a coleção.
- [ ] **Não existe coleção de projetos no CMS do Framer.** O item anterior
      ("Plugins → CMS Export" para os projetos) partia de premissa errada. O
      grafo inteiro de módulos do site — 86 arquivos em `_capturas/_runtime`,
      semeados pelas 15 páginas e seguidos transitivamente — cita **uma única**
      coleção, `displayName:"Blog"` (módulo `Zi5xpiTPh`, chunks `.framercms`).
      Nenhuma outra. Os 4 projetos são **componentes com variante**, não CMS:
      controlador `a6Nde7smU.js`, cards `Qv_x9EZNH.js`. Não adianta abrir o
      editor: não há o que exportar.
- [x] **`/projetos/cozinha-la` existe no Framer e nunca foi capturada.** O
      sitemap do Framer (`$FRAMER_BASE/sitemap.xml`, 35 URLs) tem a página;
      `paginas.mjs` não tinha. Capturada nos 3 breakpoints e auditada — é o
      conteúdo do 4º projeto, que o CMS nunca teria dado. As outras 20 URLs
      fora da tabela são artigos, que compartilham molde e já vieram no CSV.
- [x] **`cozinha-la` migrada para `public/`** — pipeline completo rodado
      (`funde` → `baixa-variantes` → `processa` → `otimiza` → portão).
      21 variantes de imagem que faltavam no clone foram baixadas. O diff
      em `public/` saiu **puramente aditivo**: a página nova mais 5 WebP,
      e nenhuma das 14 páginas antigas mudou um byte — o pipeline é
      determinístico, dá para rodar sem medo de mexer no que já passava.
- [x] **As 19 imagens de dentro dos artigos** — ver seção 7. Ficam em
      `public/img-artigos/` e são referenciadas por caminho absoluto, não
      pelo `image()` do schema: estão em `<img>` cru dentro do markdown,
      que o Astro não resolve. O `alt` delas veio **vazio do Framer** e foi
      mantido vazio — texto é do Gabriel, não se inventa.
- [ ] **Textos dos 5 painéis do acordeão** já estão em `src/lib/conteudo.ts`,
      transcritos. Falta injetar no DOM.

### 4.2. Carrossel de projetos — rolar entre os cases

Hoje só `CASA IP` aparece. O mapa de variantes confirma os 4 estados e o
componente controlador.

> **Corrigido em 01/09/2026:** são **dois** carrosséis, não um.
> `nkDfbQNR8.js` é o da **home** (existe nos 3 breakpoints, 1440×990 no
> desktop). `a6Nde7smU.js` é o de **`/projetos/`** e só existe em **tablet e
> mobile** — no desktop `/projetos/` mostra os 4 cards empilhados
> (`Qv_x9EZNH.js`), sem carrossel. Medido no Framer vivo.

- Controlador em `/projetos/` (tablet e mobile): `a6Nde7smU.js` — variantes
  `Casa IP`, `AP MM`, `STUDIO`, `COZINHA LA`
- Cards: `Qv_x9EZNH.js` — 16 variantes (projeto × breakpoint × hover/aberto)
- Movimento: `spring damping 30, stiffness 400, mass 1`
- Em `/projetos/` os 4 cards **estão no DOM** (`Casa IP - Desktop`,
  `AP MM - Desktop - Hover`, `Studio Desktop Hover`, `Cozinha LA Desktop Hover`).
  Na home o carrossel (`carousels-isa`) só tem um.

Caminho: usar o mesmo mecanismo de troca de variante, com as setas trocando
o estado do controlador. O conteúdo dos outros 3 **não vem de CMS nenhum**
(ver 4.1): sai do DOM de `/projetos/` e das capturas de cada página de
projeto, `cozinha-la` inclusive.

### 4.3. Acordeão de serviços

> **Corrigido em 01/09/2026 pela sonda de presença** (15 páginas × 3
> breakpoints no Framer vivo, medindo elemento no DOM em vez de string no
> CSS). O que estava escrito aqui atribuía o acordeão aos componentes
> errados e à página errada. Ficha completa em
> [`_capturas/motion-fichas.json`](_capturas/motion-fichas.json).

- **O acordeão é o `iCmFNLdck.js` e vive em `/sobre-nos/`**, não em
  `/servicos/` — medido em y≈2102, 1240×1055 no desktop, 936×1141 no tablet,
  358×1591 no mobile. O título da seção é "Nossos Serviços", o que explica a
  confusão. Cinco serviços: `Arquitetura Residencial`, `Arquitetura
  Comercial`, `Design de Interiores`, `Consultoria de Decoração`,
  `Ambientações`.
- **`/servicos/` não tem máquina de estado nenhuma** além de cabeçalho,
  rodapé e a seção CTA. A Fase 2 da spec (item 3) assume o contrário.
- `n8yL1JHdr.js`, `i15JnwUan.js` e `f4n4OEmqR.js` **não são o acordeão**: são
  os links **Home** (42×40), **Projetos** (59×40) e **Serviços** (63×40) do
  cabeçalho, em y=25, nas 15 páginas, só no desktop. O par `Open`/`Closed`
  deles é justamente o par inerte da trava descrita em §3 — trocar a classe
  não muda nada, e ligar clique com `preventDefault` mataria a navegação.
- Movimento do acordeão: `spring bounce .2 duration .4`, com uma segunda
  transição `spring bounce .2 duration .8`. Medido: clicar num item muda a
  altura do bloco (1591 → 1634 px no mobile), então o painel aberto **existe**
  no Framer vivo. O que falta no DOM é o conteúdo, que está transcrito em
  `src/lib/conteudo.ts`.

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

- [x] **Sitemap provisório.** `public/sitemap-index.xml` +
      `public/sitemap-0.xml` com as 15 páginas, no mesmo formato que o
      `@astrojs/sitemap` vai gerar na Fase 3 — os nomes de arquivo são os
      mesmos, então a troca não muda a URL enviada ao Search Console. Os 20
      artigos em 302 ficam de fora de propósito: sitemap é lista de canônicas
      que respondem 200.
- [ ] **GA4 e Clarity** — variáveis existem no `.env`, falta injetar.
- [x] **404 dos artigos estancados.** Eram **22**, não 20: além dos 20 sem
      página, as URLs acentuadas de `iluminação-decorativa-x-iluminação-funcional`
      e `minimalismo-vs.-maximalismo-...` também davam 404, porque `public/`
      serve o caminho em ASCII. Essas duas ganharam **301** para a rota final;
      os 20 sem página ganharam **302** para `/artigos`, que sai quando
      `/artigos/[slug]` subir na Fase 2. Verificado no domínio: **35/35 URLs
      do sitemap do Framer terminam em 200**.
- [x] **Redirect quebrado consertado.** `/sobre-nós` dava 308 para `/sobre`,
      que é 404 — URL indexada apontando para o vazio desde a virada do
      domínio. Agora aponta para `/sobre-nos`.
- [ ] **301 das demais URLs antigas.** O mapa está em `tools/paginas.mjs`; os
      artigos guardam `slugAntigo` no frontmatter (12 dos 25).
- [ ] **Search Console** — pendência externa, **não é trabalho de código**:
      a propriedade é da conta da Isabella. Falta criar a propriedade de
      domínio (ou de prefixo `https://www.isabellapiresarquitetura.com.br/`),
      enviar `https://www.isabellapiresarquitetura.com.br/sitemap-index.xml`,
      e conferir a cobertura depois que os 301/302 forem rastreados.
- [ ] Cortar o Framer.

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
| Estratégia | ~~Processar o HTML renderizado do Framer~~ → **Reconstruir em Astro medindo a captura** (spec de 01/09/2026). O HTML processado fica no ar só até cada página ser substituída |
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

**A assinatura do Framer vence em 30 de setembro de 2026.** Origem:
`https://authentic-learning-761482.framer.app/` (o domínio próprio já aponta
para a Vercel). Enquanto ela viver, tudo que for insubstituível precisa sair
de lá.

- ✅ **Capturas por breakpoint** — 45/45 da origem certa, versionadas.
- ✅ **CSV do blog** — 25 artigos importados.
- ✅ **Runtime e source maps** — baixados, mas **fora do git**. Se precisar
  sobreviver ao vencimento, faça backup fora do repo ou torne o repo privado.
- ✅ **Capas dos 25 artigos** — baixadas, em `src/content/artigos/imagens/`.
- ✅ **CSV de projetos** — não existe e nunca existiu. Ver 4.1: o conteúdo
  dos projetos é componente, e a peça que faltava (`cozinha-la`) já foi
  capturada.
- ✅ **19 imagens dentro do corpo de 6 artigos** — baixadas com
  `baixa-imagens-do-corpo.mjs`. WebP em `public/img-artigos/` (36,9 MB →
  17,0 MB), originais em `_importar/imagens/corpo/` (fora do git). Os
  markdowns foram reescritos: **nenhum artigo depende mais da CDN do
  Framer.**

Sobra uma dependência cosmética: as 15 páginas trazem
`<meta name="framer-search-index" content="https://framerusercontent…">`.
É metadado inerte — o runtime que o lia foi removido —, mas é um site que
saiu do Framer anunciando o Framer no `<head>`. Limpar no lançamento.

---

## 8. Credenciais

Tudo em `.env` (ignorado pelo git). `.env.example` é o formulário em branco.

**Preenchidas:** `GH_TOKEN`, `GITHUB_USUARIO` (arqisabellapires),
`VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `PUBLIC_SUPABASE_URL`,
`PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`SUPABASE_DATABASE_PASSWORD`.

**Preenchidas desde então:** `BREVO_DESTINO_EMAIL` e
`BREVO_LISTA_NEWSLETTER_ID` (= 3). Verificado em 03/09/2026: a API da Brevo
responde 200, o domínio consta autenticado, e o formulário entrega e-mail de
verdade.

**Faltam:** `PUBLIC_GA4_ID`, `PUBLIC_CLARITY_ID`.

Na Vercel já estão (produção, preview e dev): `BREVO_API_KEY` (encrypted),
`BREVO_REMETENTE_EMAIL`, `BREVO_REMETENTE_NOME`. Variável nova só vale a
partir do próximo deploy.

O git não tem credential helper. Para dar push:

```bash
set -a && . ./.env && set +a
git -c credential.helper='!f() { echo username=x-access-token; echo "password=$GH_TOKEN"; }; f' push
```

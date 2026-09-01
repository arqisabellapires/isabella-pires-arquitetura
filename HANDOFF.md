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
- **Fusão de breakpoints aplicada às 14 páginas.** O portão de pixel:

  | Breakpoint | Passam | Alturas |
  |---|---|---|
  | desktop 1440 | 13/14 | todas idênticas |
  | tablet 1000 | 13/14 | todas idênticas |
  | mobile 390 | **14/14** | todas idênticas |

  40 de 42. A única falha é `/artigos/` no desktop (1,02%) e tablet (0,88%),
  que passa em 0,09% no celular.
- Imagens em WebP: **142,8 MB → 60,5 MB (−58%)**. É maior que os 25,7 MB
  anteriores porque agora inclui as variantes de celular e tablet, que o
  clone de desktop não tinha.
- Fontes self-hospedadas (3 origens: Google, assets do Framer, Fontshare)
- Deploy automático: commit → push → build → Vercel
- No ar: https://isabella-pires-arquitetura.vercel.app

### Não funciona ainda
- **`/artigos/` fica ~1% acima do limite** no desktop e no tablet. Já foram
  descartados: layout (DOM idêntico, mesmas posições), imagens (mesmos 24
  arquivos nas mesmas posições) e codec (a CDN do Framer serve AVIF para o
  navegador e PNG para `fetch`, mas isso vale só 0,19% — medido). A causa
  real não foi encontrada. Como a página vira template do CMS de qualquer
  forma, foi deixada assim de propósito.
- **Movimento: o que existe, o que falta.** Medido, não estimado — e a
  medição corrigiu duas conclusões erradas anteriores.

  **Hover não existe no site original.** Varredura no site vivo do Framer:
  **0 de 46 elementos**, em 3 páginas, respondem ao ponteiro. Links,
  botões e imagens não têm hover lá. Uma versão anterior deste documento
  dizia "327 links sem hover, 92 imagens sem zoom" — era erro de método:
  mediu-se a nossa saída sem conferir se a original fazia algo.
  *Ressalva:* medido com ponteiro sintético do Playwright.

  **O que de fato funciona hoje**, em `public/interacoes.js`:

  | Interação | Como |
  |---|---|
  | Scroll reveals | Reimplementados. Mola por oscilador amortecido |
  | Menu de celular | Troca de variante — cabeçalho 59px → 223px |
  | Hover do card de projeto | Troca de variante — 557px → 367px |

  **O mecanismo genérico:** o CSS de *todas* as variantes de um componente
  vem servido na página, inclusive das que o HTML não usa — são os estados
  de hover e aberto esperando alguém aplicar. `tools/extrai-variantes.mjs`
  lê `variantClassNames` e `humanReadableVariantMap` do fonte do Framer e
  gera `public/variantes.json` pareando repouso → resposta pelos nomes que
  a designer deu ("Casa IP Desktop - Hover"). Reviver a interação é trocar
  a classe.

  **Trava importante:** o runtime testa cada par antes de ligar handler —
  troca a classe, mede, desfaz. Par que não muda nada é descartado. Sem
  isso, o cabeçalho (que tem par Open/Closed inerte) receberia um handler
  de clique com `preventDefault` e **mataria a navegação do site inteiro**.
  Nunca chamar `preventDefault` em clique que caiu num `a[href]`.

  **Falta**, e os dois dependem de conteúdo ausente do DOM:
  - **Acordeão de serviços** — trocar a classe não muda nada, porque o
    painel aberto não tem conteúdo. Os 5 textos estão em `src/lib/conteudo.ts`.
  - **Carrossel de projetos** — só `CASA IP` no DOM. O mapa de variantes
    confirma 4: `Casa IP`, `AP MM`, `STUDIO` e `COZINHA LA`, esta última
    sem página no clone.

- **`/artigos/` fica ~1% acima do limite** no desktop e no tablet. Já foram
  descartados: layout (DOM idêntico, mesmas posições), imagens (mesmos 24
  arquivos nas mesmas posições) e codec (a CDN do Framer serve AVIF para o
  navegador e PNG para `fetch`, mas isso vale só 0,19% — medido). A causa
  real não foi encontrada. Como a página vira template do CMS de qualquer
  forma, foi deixada assim de propósito.
- **Praticamente todo o movimento está morto, não "4 interações".** Isso foi
  medido, não estimado. O Framer faz hover por **variante em JavaScript**,
  não por CSS — existem 51 regras `:hover` no CSS servido, e nenhuma pega
  os elementos que importam. Teste: 0 de 12 elementos da primeira dobra de
  `/projetos/` respondem ao ponteiro.

  | Medido, só no desktop, nas 14 páginas | |
  |---|---|
  | Links visíveis sem hover | 327 |
  | Botões sem hover | 50 |
  | Imagens sem zoom | 92 |
  | Nós com estado (`Closed`/`Trigger`/`Hover`) | 74 |

  No fonte do Framer: 498 `onTap`, 40 `useVariantState`, 17 componentes com
  máquina de estado de 2 a 16 variantes.

  **Não são 500 trabalhos distintos** — cabeçalho e rodapé se repetem nas 14
  páginas. Em componentes distintos são cerca de dez: hover de link de
  navegação, hover de botão, zoom de imagem, card de projeto, card de
  artigo, acordeão, carrossel, menu de celular, e os scroll reveals, que
  são os únicos prontos.
- **O passo WebP não foi reverificado.** Os 40/42 foram medidos antes dele.

### Duas armadilhas que quase falsificaram o resultado

1. **Servidores zumbis.** Dois `python3 -m http.server` de uma sessão
   anterior seguravam as portas 8901/8902. Os do verificador não subiam,
   morriam calados, e a referência vinha 404 — toda página "divergia" 100%
   com altura de viewport. `tools/servidor.mjs` agora procura porta livre e
   confirma que a pasta está sendo servida antes de qualquer medição.

2. **Duas capturas eram do nosso próprio site.** `servicos` e `contato` em
   `_capturas/` não vinham do Framer, e sim da Vercel: zero referências ao
   framerusercontent e os três breakpoints idênticos ao byte. Essas páginas
   estavam comparando a migração **com ela mesma** e aprovando. Recapturadas.
   `captura-breakpoints.mjs` agora recusa gravar captura sem o runtime do
   Framer ou com os 3 breakpoints iguais, e `audita-capturas.mjs` confere
   as 14 de uma vez.

## 4. Ferramentas no repositório

Todas em `tools/`, todas re-executáveis.

| Script | O que faz |
|---|---|
| `paginas.mjs` | **Tabela única** das 14 páginas e dos 3 breakpoints. Todos leem daqui |
| `captura-breakpoints.mjs` | Captura as 14 páginas × 3 breakpoints do site **vivo** → `_capturas/` |
| `audita-capturas.mjs` | Confere que toda captura é mesmo do Framer, não do nosso site |
| `funde-breakpoints.mjs` | Funde as 3 capturas de cada página num HTML só, com media queries |
| `baixa-variantes.mjs` | Baixa do Framer as variantes de imagem que só o celular/tablet pedem |
| `servidor.mjs` | Sobe servidor estático em porta livre e confirma que serve |
| `diagnostica-diferenca.mjs` | Diz *onde* uma página diverge, em texto, sem abrir os mapas |
| `processa-framer.mjs` | Tira o runtime, reescreve assets e links, copia imagens e fontes → `public/` |
| `otimiza-imagens.mjs` | Converte para WebP e reescreve as referências no HTML |
| `verifica-fidelidade.mjs` | **O portão.** Compara cada página com a original, pixel a pixel |
| `importa-framer.mjs` | Converte os CSV do CMS do Framer em markdown |

### Como rodar o ciclo completo
```bash
node tools/captura-breakpoints.mjs      # só enquanto o Framer existir
node tools/audita-capturas.mjs         # confere que as capturas são do Framer
node tools/funde-breakpoints.mjs
node tools/baixa-variantes.mjs         # só enquanto o Framer existir
node tools/processa-framer.mjs
node tools/otimiza-imagens.mjs
node tools/verifica-fidelidade.mjs             # os 3 breakpoints
node tools/verifica-fidelidade.mjs --bp mobile # um só
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

## 5. Fusão de breakpoints — feita

As 14 páginas foram fundidas e passam pelo portão. Os números estão na
seção 3.

O truque é `display: contents` no invólucro de cada árvore: ele some do
layout, então as regras do Framer continuam valendo como se os filhos
fossem diretos do `<body>`. O `<head>` é byte-idêntico entre os três
breakpoints nas 14 páginas (conferido por MD5), então entra uma vez só.

Breakpoints reais do Framer, extraídos do CSS dele e agora em
`tools/paginas.mjs`, que é a tabela única que todos os scripts leem:
- desktop `(min-width: 1200px)`
- tablet `(min-width: 810px) and (max-width: 1199.98px)`
- mobile `(max-width: 809.98px)`

O clone de desktop não tinha as variantes de imagem que o celular e o
tablet pedem — eram 276, baixadas por `baixa-variantes.mjs` enquanto o
Framer está no ar. Antes disso o processador caía no fallback "maior
variante disponível", que entrega a imagem certa na resolução errada.

## 6. Depois disso

1. **Interações.** O runtime do Framer foi baixado com os **source maps
   publicados**, então existe o código-fonte original (não minificado) como
   especificação. `baixa-runtime.mjs` e `extrai-fontes.mjs` refazem isso
   enquanto o Framer viver. **Fora do git de propósito**: é código
   proprietário do Framer e este repositório é público. Se precisar
   sobreviver ao vencimento da assinatura, faça backup fora do repo.

   Onde mora cada uma, em `_fonte-framer/https:/framerusercontent.com/modules/`:

   | Interação | Arquivo | Movimento |
   |---|---|---|
   | Acordeão | `uecwB1KwkJFtBMPwNyzd/…/Qv_x9EZNH.js` | spring bounce .2 dur .4 |
   | Carrossel | `PfylROkYYGkR2aow5ETM/…/a6Nde7smU.js` | spring damping 30 stiffness 400 |
   | Reveals | `IbsRGwyzKW2hSLkLaVJo/…/sBuWTkbUo.js` | spring bounce .2 dur .8 |

   **Scroll reveals: feitos.** `public/interacoes.js`, escrito do zero — só
   os valores vieram da dissecação. Mola por oscilador harmônico
   amortecido. Pega dois casos: `opacity:0` com `translateX(-150px)`, e
   elemento congelado no meio da animação na captura (`opacity .5`,
   `scale .9`). Não toca em `scale` acima de 1, que é zoom de imagem no
   hover — confundir os dois faria a foto de `/servicos/` saltar sozinha.
   Respeita `prefers-reduced-motion`.

   **Consequência no portão:** o verificador agora roda com
   `javaScriptEnabled: false` nos dois lados. A referência já vinha sem
   `<script>`; sem isso a nossa saída revelaria os elementos e acusaria
   divergência falsa. O portão mede fidelidade do DOM estático, que é o
   que ele sempre mediu.

   As outras três exigem injetar conteúdo que o Framer buscava do CMS:
   - **Acordeão de serviços**: os painéis fechados não têm texto no DOM. Os 5
     textos já estão transcritos em `src/lib/conteudo.ts`.
   - **Carrossel de projetos**: só `CASA IP` está no DOM. Existem 4 projetos —
     o quarto é `COZINHA LA`, descoberto clicando a seta na referência, e não
     tem página no clone.
   - **Menu de celular**: o gatilho é um `svg` de 24×24 no topo, em 390px.
     O painel aberto não está no DOM.
2. ~~**Formulário** → Brevo.~~ Feito — ver seção 6.1.
3. **Sitemap** — o do Astro não gera mais nada, porque não há páginas em
   `src/pages/`. Precisa sair do pipeline.
4. **GA4 e Clarity** — as variáveis existem no `.env`, falta injetar.
5. **Lançamento** — DNS no registro.br, 301 das URLs antigas, Search Console,
   e cortar o Framer.
6. **CMS** — Supabase. As páginas de artigo compartilham um molde; a região
   de conteúdo vira slot.

### 6.1. Brevo — o que existe e o que trava

**Código, pronto e testado localmente:**

| Arquivo | Papel |
|---|---|
| `src/lib/brevo.ts` | Cliente da API: e-mail transacional e criação de contato |
| `src/lib/antispam.ts` | Campos-isca, limite por IP, validação de e-mail |
| `src/lib/ambiente.ts` | Lê env de `process.env` **e** `import.meta.env` |
| `src/lib/resposta.ts` | Responde JSON para o fetch, 303 para envio sem JS |
| `src/pages/api/contato.ts` | Formulário de contato (home e /contato) |
| `src/pages/api/newsletter.ts` | Inscrição do rodapé de /artigos |
| `public/formularios.js` | Intercepta o submit e responde na própria página |

O `processa-framer.mjs` ganhou o passo 5: injeta `method`/`action` em cada
`<form>` do Framer, escolhendo a rota pela presença do campo `Mensagem`. Por
isso o envio funciona **mesmo sem JavaScript** — o endpoint devolve 303 de volta
para a página com `?envio=ok|erro`. Nada é inserido no DOM antes do primeiro
envio, para não quebrar o portão de fidelidade.

Os 11 campos-isca são os que o **próprio Framer** já emitia (`website`,
`company`, `message`, `subject`…). Não foram inventados; foram reaproveitados.

**Verificado local** (`astro dev` + curl): isca → 200 silencioso; campo faltando
→ 422; e-mail inválido → 422; sem JS → 303 com `?envio=`; 6º envio válido em
10 min → 429. Os dois formatos que o navegador usa (urlencoded e multipart)
parseiam igual, inclusive com o campo acentuado `Serviço`.

**Decisão:** o limite por IP roda **depois** da validação. Ele protege a cota de
300 envios/dia da Brevo, e envio recusado por validação não consome cota —
contar tentativa inválida trancaria por 10 min quem só errou o e-mail.

**Ressalva:** o limite é um `Map` em memória, por instância da função. Segura
repetição de um visitante, não ataque distribuído. Se um dia não bastar, o
próximo passo é KV/Upstash, não afinar os números.

**Armadilha medida, não suposta:** a `POST /v3/smtp/email` devolve **201 com
`messageId`** e só **depois** rejeita, de forma assíncrona. Com o domínio não
autenticado, o log de eventos mostra `requests` seguido de `error — Sending has
been rejected because the sender you used ... is not valid`. Ou seja: a resposta
de sucesso da API **não é prova de entrega**, e o visitante vê "Recebido"
enquanto o lead se perde. A única verificação confiável é
`GET /v3/smtp/statistics/events`, que leva ~30 s para popular.

Consequência prática: **não vale subir o formulário em produção antes de o DKIM
estar propagado.** A alternativa provisória é trocar `BREVO_REMETENTE_EMAIL` para
`arqisabellapires@gmail.com`, que já é remetente validado — funciona hoje, mas
sai com DMARC desalinhado (o domínio do envelope não é gmail.com) e tende a
cair em spam.

**O bloqueio por IP é instável.** Depois de autorizar o IP, as chamadas passaram
a alternar entre 200 e 401 na mesma sequência — a lista propaga de forma desigual
entre os nós da Brevo. Para função da Vercel, com IP dinâmico, whitelist não é
opção: o recurso precisa ficar **desligado**.

**O que trava agora, em ordem:**

1. **Autenticar o domínio na Brevo.** Único bloqueio restante. O domínio já foi
   criado (id `6a9627fd736b02920808cf56`); faltam 4 registros no registro.br:

   | Tipo | Nome | Valor |
   |---|---|---|
   | CNAME | `brevo1._domainkey` | `b1.isabellapiresarquitetura-com-br.dkim.brevo.com` |
   | CNAME | `brevo2._domainkey` | `b2.isabellapiresarquitetura-com-br.dkim.brevo.com` |
   | TXT | *(vazio = raiz)* | `brevo-code:e2319a36aed4e27d5e035c9e8f99e8c0` |
   | TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

   Conferir com `GET /v3/senders/domains` até `authenticated: true`.
2. **Redeploy.** As variáveis de ambiente da Vercel só valem no build seguinte.
   Hoje `/api/contato` em produção devolve 502 por env ausente — o que, por sorte,
   é melhor que o falso sucesso descrito acima.

### 6.2. Destinos do lead e e-mails de confirmação

Os prints da configuração do Framer mostraram que o formulário original mandava
o lead para **dois** destinos — e-mail *e* uma planilha do Google Sheets — e
depois **redirecionava para `/`**. Decisões tomadas com o Gabriel:

| Item | Original (Framer) | Agora |
|---|---|---|
| Aviso para a arquiteta | e-mail | e-mail (igual) |
| Arquivo do lead | Google Sheets | lista "Leads do site" na Brevo (id 4) |
| Confirmação para quem preencheu | não existia | e-mail curto de confirmação |
| Newsletter | — | entra na lista + e-mail de boas-vindas |
| Depois do envio | redireciona para `/` | mensagem na própria página |

A planilha saiu para não depender de service account do Google e para deixar
tudo num painel só; a lista exporta CSV. O redirecionamento para `/` foi
deliberadamente **não** reproduzido: perder a página depois de enviar é pior, e
a mensagem inline resolve. Se a cliente sentir falta, é uma linha em
`formularios.js`.

**Só o aviso para a arquiteta é obrigatório.** O arquivo do lead e a confirmação
rodam em `Promise.allSettled` e falham para o log, nunca para a tela: o e-mail
já chegou, e dizer "não consegui enviar" faria a pessoa mandar tudo de novo.

**Armadilha:** a conta Brevo está em **português**, então os atributos padrão
são `NOME`/`SOBRENOME`, não `FIRSTNAME`/`LASTNAME`. A API de contatos
**descarta atributo desconhecido em silêncio**, com 200 e sem aviso — foi assim
que o nome do lead sumiu na primeira versão. Conferir sempre com
`GET /v3/contacts/attributes` antes de gravar.

**Textos provisórios:** o corpo da confirmação e o das boas-vindas foram
escritos por falta de original — o Framer não tinha nenhum dos dois. Estão
marcados no `brevo.ts` e precisam da revisão do Gabriel.

**Verificado:** os três e-mails saíram como `delivered` (aviso, confirmação do
lead, boas-vindas) e os atributos `NOME`, `TELEFONE`, `SERVICO`,
`ULTIMA_MENSAGEM` e `ORIGEM` gravaram certo. Contatos de teste removidos.

**Já resolvido:** conta Brevo é `arqisabellapires@gmail.com`, plano free, 300
envios/dia. Atenção à cota: cada contato pelo formulário agora consome **2**
envios, não 1. `BREVO_DESTINO_EMAIL=arqisabellapires@gmail.com` (única caixa que
existe — a zona não tem MX, então `contato@` não recebe). Lista "Newsletter do
blog" criada, `BREVO_LISTA_NEWSLETTER_ID=3`. As cinco variáveis estão na Vercel.

**Verificado contra a API real:** a newsletter funciona fim a fim — o contato de
teste apareceu na lista 3 e foi removido depois. O contato ainda não, por causa
do item 1.

**Resquício:** `src/components/Formulario.astro` é da reconstrução manual
abandonada e não é usado por nada — o formulário real é o HTML do Framer.
Apagar quando alguém confirmar que não serve de referência.

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

**Faltam:** `BREVO_DESTINO_EMAIL`, `BREVO_LISTA_NEWSLETTER_ID`,
`PUBLIC_GA4_ID`, `PUBLIC_CLARITY_ID`.

Na Vercel já estão configuradas (produção, preview e dev): `BREVO_API_KEY`
(encrypted), `BREVO_REMETENTE_EMAIL`, `BREVO_REMETENTE_NOME`. Variável nova só
vale a partir do próximo deploy.

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

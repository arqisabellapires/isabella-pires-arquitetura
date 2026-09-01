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

**Já resolvido:** conta Brevo é `arqisabellapires@gmail.com`, plano free, 300
envios/dia. `BREVO_DESTINO_EMAIL=arqisabellapires@gmail.com` (única caixa que
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

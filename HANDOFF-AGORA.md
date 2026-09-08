# Handoff — estado do projeto e o que falta

Atualizado em 08/09/2026. **Cole este arquivo numa sessão nova e comece por
aqui.** Ele substitui os handoffs anteriores como ponto de partida;
`HANDOFF-ANIMACAO.md` e `HANDOFF-PROXIMO.md` continuam valendo como registro
detalhado do que já foi auditado.

---

## 1. Onde o projeto está

**O site novo está no ar, no domínio oficial**, e o CMS funciona: a Isabella
consegue publicar um artigo sozinha, sem código e sem pedir deploy.

- `https://www.isabellapiresarquitetura.com.br` — deploy automático a cada
  push na `main`.
- **Tudo empurrado.** Nada pendente no repositório local.
- Último commit: `0f8c430`.

O que foi construído na última sessão (07/09/2026), em três frentes:

1. **Auditoria de movimento** contra os vídeos do Framer;
2. **Blog refeito** seguindo o Framer;
3. **CMS em Supabase**, com painel e rebuild automático.

---

## 2. As regras que regem este projeto

Fixadas pelo Gabriel, e válidas para tudo que vier:

- **O Figma manda na FORMA** — que desenho a seção tem.
- **O Framer manda no TAMANHO** — altura de menu, corpo de fonte, imagem.
- **Os vídeos mandam no MOVIMENTO.**
- **No BLOG, o Framer manda em tudo**, forma inclusive. É a única inversão.

Outras preferências dele, que valem tanto quanto:

- **Sem datas e sem estimativas.** Só ordem, dependências e portão de saída.
- **Commit direto na `main`**, sem branch nem PR. O portão é medido, não
  revisado.
- **Respostas curtas.** Ele pediu isso explicitamente. Não escreva relatório
  quando uma frase resolve.

### As fontes de verdade

| Fonte | Onde | Serve para |
|---|---|---|
| Site do Framer | https://authentic-learning-761482.framer.app/ | tamanho, e a forma do blog |
| Capturas | `_capturas/<rota>/medidas.*.json` | o mesmo, offline e medível |
| HTML do Framer | `_capturas/<rota>/desktop.html` | ler a ESTRUTURA de uma tela |
| Figma | fileKey `w03gcodehy5qey828y58hS` | forma das outras seis telas |
| Vídeos | `_capturas/_videos/` (133 arquivos) | movimento |

> A URL do Framer responde 200, mas o Playwright dá **timeout** com
> `waitUntil: 'networkidle'` — ele mantém conexões abertas. Use
> `domcontentloaded` + espera, ou prefira as capturas locais.
>
> `_fonte-framer/` **não tem HTML** — são 116 `.js` do bundle.

---

## 3. O que a auditoria de movimento respondeu

O Gabriel tinha descrito três comportamentos de memória. **Foram medidos, não
olhados** — as conclusões abaixo têm número por trás:

- **Zoom interno ao rolar: NÃO EXISTE.** A escala interna das fotos dá
  **1.000 com erro ~0**, no acordeão de `/sobre-nos` e nos cards de
  `/servicos`, inclusive nos 400 ms logo depois de um passo de rolagem de
  391 px — que é onde um `animation-timeline: view()` apareceria. O controle
  (hover do card de projeto) mostra crescimento óbvio no mesmo instrumento,
  então a medição detecta movimento real quando ele existe. **Nada a fazer.**
- **Sticky em "Sobre nós": EXISTE, mas é à DIREITA.** Ele lembrava do texto
  fixo à esquerda; no Framer o texto está à direita (x=785) e os passos 01–04
  rolam à esquerda. **Já implementado.**
- **Carrosséis e hover: JÁ ESTAVAM CERTOS.** Nada a mudar.

**Diferença pequena, deixada de propósito:** no Framer o card de projeto
cresce em altura no hover e empurra a página; o nosso dá `scale(1.03)` na
foto dentro de caixa fixa de 450 px. Equivalente, e não reflowa. Se um dia
for para igualar, é em `src/pages/projetos/index.astro`.

### Como ler vídeo sem estourar contexto

**Não há ffmpeg nesta máquina** (nem binário, nem npm; instalar pede sudo).
Handoffs antigos sugerem ffmpeg — ignore.

```bash
node tools/quadros-video.mjs <arquivo.webm> [n] [saida.png]
```

Decodifica o webm no Chromium do Playwright e monta uma tira PNG com N
quadros carimbados. Um vídeo de 6 s a 30 fps são 180 imagens; 4 quadros
bastam para ler um zoom ou um sticky.

Duas armadilhas já resolvidas dentro dela: `file://` não decodifica (precisa
de HTTP **com `Range`**), e `page.setContent()` espera o vídeo inteiro e dá
timeout — monte o `<video>` por `evaluate` depois de `domcontentloaded`.

> **O Playwright não está no `node_modules` deste projeto.** As ferramentas o
> importam por caminho absoluto de um repo vizinho:
> `/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs`.

> **Correção a handoff antigo:** `servicos.desktop.acordeao-servicos.webm`
> **não existe**. O acordeão foi capturado em `sobre-nos`.

---

## 4. O CMS

**Decisões do Gabriel (07/09/2026), já implementadas:** Supabase (e não
markdown-no-repo), **dois acessos** (Isabella e Gabriel), e — deixado a
critério do agente — **rebuild por webhook**, porque o projeto é
`output: 'static'` e o conteúdo muda uma vez por mês.

> O projeto Supabase do `.env` estava **completamente vazio** quando
> começamos, apesar das credenciais válidas. Não havia nada a aproveitar.

```bash
npm run cms:migra      # aplica supabase/migracoes/ (idempotente)
npm run cms:importa    # carga inicial dos markdown (idempotente)
node tools/cria-editor.mjs <email> "<Nome>"   # cria/redefine acesso
```

- **Loader:** `src/lib/loader-supabase.ts`. A promessa do
  `content.config.ts` foi cumprida — o `glob()` virou `artigosDoSupabase()` e
  **as páginas não mudaram**, exceto `width`/`height` no `<Image>`.
- Os **25 artigos e as 25 capas** estão no banco. Os markdown em
  `src/content/artigos/` são **acervo** — não são mais lidos no build.
- **Painel:** `/painel/entrar`, `/painel`, `/painel/artigo`. Fora do sitemap,
  `Disallow` no robots, `noindex` nas três.
- **`/api/publica`** dispara o Deploy Hook e **confere que quem pediu é
  editor** antes — a URL do hook é segredo e não vai para o navegador.

### Quatro armadilhas que já custaram tempo

Se for mexer no CMS, leia antes:

1. **RLS recursiva.** Política de `editores` que consulta `editores` entra em
   recursão infinita ("infinite recursion detected"). Resolvido com
   `public.e_editor()`, `security definer` (migração 004). **Política nova
   deve usar a função, não um `exists`.**
2. **`innerHTML` não recebe o `data-astro-cid`** do escopo, e o CSS escopado
   não o alcança — a lista do painel saía sem borda e com título de 60 px. O
   estilo dela é `is:global` de propósito.
3. **`<Image>` exige `width`/`height` de imagem remota**, senão o build falha
   com `MissingImageDimension`. Daí `capa_largura`/`capa_altura` no banco,
   medidos no upload.
4. **O corpo do artigo é HTML**, gravado e servido como HTML — **não** passa
   por `renderMarkdown`, que envolveria linhas soltas em `<p>` e estragaria a
   marcação que a `artigo.css` foi medida para estilizar.

> `src/styles/artigo.css` traz um aviso no topo: não editar por gosto. Foi
> medida contra a captura do Framer.

---

## 5. O que falta — em ordem

### 5.1. Pendências do Gabriel (não são de agente)

- **Entregar a senha da Isabella.** A conta
  `arqisabellapires@gmail.com` existe e funciona, mas a senha foi gerada numa
  sessão e **nunca foi entregue**. Para gerar outra:
  `node tools/cria-editor.mjs arqisabellapires@gmail.com "Isabella Pires"`
  (imprime uma vez só; entregar por canal seguro).
- **Pegar os IDs do GA4 e do Clarity.** `PUBLIC_GA4_ID` e
  `PUBLIC_CLARITY_ID` estão **vazios no `.env`** — a linha existe, o valor
  não. O banner de consentimento está no ar mas **não mede nada**, e as duas
  também não estão na Vercel. Painéis: GA4 → Admin → Fluxos de dados;
  Clarity → Settings → Overview.
- **CNPJ:** continua sem existir no código. Ele ia perguntar à cliente se ela
  tem — pode ser que seja informal. **Não invente número.**

### 5.2. Trabalho de agente, por prioridade

1. **Testar o painel no celular.** Foi conferido só em 1280 px, e é
   provável que ela publique do telefone. É o maior risco aberto: se o
   formulário não funcionar no celular dela, o CMS não serve.
2. **Editor de texto rico.** Hoje ela escreve `<p>` e `<h2>` na mão, num
   `<textarea>`. É o que mais atrapalha o uso diário.
3. **Apagar artigo** não existe no painel (só despublicar).
4. **Lighthouse** — nunca foi rodado (`npm run audita:lighthouse` existe).
5. **Search Console** — nunca foi tocado.

---

## 6. Os portões

```bash
npx astro build                      # 45 páginas (42 + 3 do painel)
node tools/valida-fontes.mjs         # 13 famílias
node tools/audita-paginas.mjs
node tools/verifica-revela.mjs
node tools/verifica-responsivo.mjs
node tools/tira-foto.mjs [--bp tablet|mobile] [/rota]
node tools/tamanhos-framer.mjs [rota]
node tools/quadros-video.mjs <video.webm> [n]
```

Todos passam hoje. **E nenhum deles mede animação** — passar nos portões não
é evidência de que o movimento está certo. Só o vídeo lado a lado responde.

Duas coisas aprendidas sobre os próprios portões:

- `audita-paginas` lê título e descrição **do arquivo**, não do DOM vivo:
  as páginas do painel redirecionam para o login, e as três reportavam o
  título da tela de entrada — duplicata que não existia.
- `tira-foto` já teve dois defeitos consertados (fotografava antes de o
  carrossel se posicionar, e com imagens preguiçosas ainda cinzas). Não
  reintroduza.

---

## 7. Infraestrutura

- **Deploy:** Vercel, automático a cada push na `main`. **Empurrar publica no
  site oficial** — não há staging.
- **Push funciona** com o `GH_TOKEN` do `.env` (conta `arqisabellapires`).
- **Variáveis na Vercel:** as 6 do Brevo mais as 4 do Supabase
  (`PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `VERCEL_DEPLOY_HOOK`). **Faltam GA4 e
  Clarity**, porque ainda não existem valores.
- **Se adicionar variável nova que o build usa, crie na Vercel ANTES de
  empurrar** — senão o build quebra lá. Já quase aconteceu.
- **Zero requisição externa** no navegador do visitante: as capas saem
  otimizadas para o nosso domínio (`/_astro/...webp`), e a Política de
  Cookies afirma isso ao visitante. **Nunca puxe fonte do Google Fonts.**
- **As três páginas de política** existem, com banner de consentimento que de
  fato controla GA4/Clarity. **Nenhuma passou por advogado** — cada uma avisa
  isso no rodapé.

---

## 8. Onde fica cada coisa

```
src/pages/            as rotas (index, servicos, sobre-nos, contato,
                      projetos/, artigos/, painel/, api/)
src/components/       Cabecalho, Rodape, CarrosselProjetos, AcordeaoServicos,
                      AvisoCookies, artigos/, formularios/
src/lib/              conteudo.ts, site.ts, artigos.ts, brevo.ts, ambiente.ts,
                      loader-supabase.ts, supabase-navegador.ts
src/styles/           tokens.css, motion.css, artigo.css, fontes.css, revela.css
src/content/          artigos/ (acervo) e projetos/ (ainda em markdown)
supabase/migracoes/   001..004, aplicadas
tools/                ~40 ferramentas (ver tabela no HANDOFF.md antigo)
_capturas/            capturas do Framer: medidas, HTML e os 133 vídeos
_figma/               medidas e fotos do Figma
docs/                 ENTENDA-O-PROJETO.md e as specs
```

**Ainda em markdown:** `src/content/projetos/`. Só os artigos migraram para o
banco. Se um dia os projetos forem para o CMS, o caminho é o mesmo — trocar o
`loader` em `content.config.ts`.

### Recapturar do Framer

**A origem do Framer não é o domínio próprio** — o domínio já serve o nosso
site, e capturar de lá traz a migração de volta como se fosse referência.

```bash
export FRAMER_BASE=https://authentic-learning-761482.framer.app
```

O Framer da cliente **vence em 30/09/2026**. Depois disso as capturas locais
em `_capturas/` são a única referência que sobra — não as apague.

---

## 9. Histórico

Estes três documentos são registro, não roteiro. Leia se precisar do porquê
de alguma decisão:

- **`HANDOFF.md`** — a migração Framer→Astro, as ferramentas de captura e as
  lições de método (medida serve para geometria, não para prosa).
- **`HANDOFF-PROXIMO.md`** — a reconstrução contra o Figma, tela a tela.
- **`HANDOFF-ANIMACAO.md`** — a auditoria de movimento em detalhe.
- **`docs/ENTENDA-O-PROJETO.md`** — o porquê do projeto, para quem chega agora.

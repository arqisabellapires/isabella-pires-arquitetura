# Handoff — o que a auditoria de movimento respondeu, e o que sobrou

> **Chegando agora? Comece por [HANDOFF-AGORA.md](HANDOFF-AGORA.md)**
> — o estado atual e o que falta. Este documento é histórico.


Atualizado em 07/09/2026, depois da sessão que executou as três frentes do
handoff anterior. **As três foram feitas.** Este documento agora registra o
que se descobriu e o que continua aberto.

---

## 1. As regras que regem este projeto

Inalteradas:

- **O Figma manda na FORMA** — que desenho a seção tem.
- **O Framer manda no TAMANHO** — altura de menu, corpo de fonte, imagem.
- **Os vídeos mandam no MOVIMENTO.**
- **No BLOG, o Framer manda em tudo**, forma inclusive.

### Ferramenta nova: ler vídeo sem estourar contexto

**Não há ffmpeg nesta máquina** (nem binário, nem pacote npm; instalar pede
sudo). O handoff anterior sugeria ffmpeg — ignore.

```bash
node tools/quadros-video.mjs <arquivo.webm> [n] [saida.png]
```

Decodifica o webm no Chromium do Playwright e monta uma tira PNG com N
quadros carimbados com o instante. Duas armadilhas já resolvidas dentro
dela: `file://` não decodifica (precisa de HTTP **com `Range`**), e
`page.setContent()` espera o vídeo inteiro e dá timeout.

> O Playwright **não está** no `node_modules` deste projeto. As ferramentas o
> importam por caminho absoluto de um repo vizinho:
> `/home/gabfelix/dev/portfolio/node_modules/playwright/index.mjs`.

---

## 2. As três lembranças do Gabriel — respondidas

### 2.1. Zoom interno nas imagens ao rolar — **NÃO EXISTE**

> "as imagens iam dando um zoom interno bem legal, cada uma."

**Medido, não olhado.** Escrevi um comparador que estima a escala interna
quadro a quadro compensando a rolagem. Resultado: **escala 1.000** com erro
~0, tanto no acordeão de `/sobre-nos` quanto nos cards de `/servicos` —
inclusive nos 400 ms logo depois de um passo de rolagem de 391 px, que é
exatamente onde um `animation-timeline: view()` apareceria.

O controle (`projetos.desktop.card-projeto-hover.webm`) mostra crescimento
óbvio no mesmo instrumento, então a medição **detecta movimento real quando
ele existe**. Não há zoom ao rolar. Nada a implementar.

A impressão provavelmente vem do hover dos cards de projeto (§2.3), que
cresce de verdade.

### 2.2. Texto fixo à esquerda em "Sobre nós" — **CONFIRMADA, mas é à DIREITA**

Confirmada no vídeo `sobre-nos.desktop.reveal-entrada.webm`: entre 10,8 s e
12,2 s o bloco "Passo a passo / Nós temos um método simples" fica parado na
mesma altura da janela enquanto 01→02 e 03→04 passam.

**A lateralidade estava trocada na lembrança:** no Framer o texto fixo está à
**direita** (x=785) e os passos rolam à **esquerda** (x=132..753).

**Já implementado** em `src/pages/sobre-nos.astro`, em duas colunas. Duas
armadilhas que ficaram registradas no código:

- um ancestral com `transform` (o `data-revela`) vira o bloco de contenção do
  `position: sticky` e solta o grude no meio da rolagem;
- o percurso de um sticky é `altura da linha − altura do elemento`.

### 2.3. Carrosséis e hover — **JÁ ESTAVA CERTO**

O carrossel do Framer é slide ativo maior e centralizado, vizinhos menores e
esmaecidos, quatro bolinhas, setas e legenda. `CarrosselProjetos.astro` já
faz exatamente isso (545 px no ativo contra 451 px nos vizinhos, véu de 20%
que some no ativo) e já usa a mola medida. Nada a mudar.

**Uma diferença pequena, deixada de propósito:** no Framer o card de projeto
**cresce em altura** no hover e empurra a página; o nosso dá `scale(1.03)` na
foto dentro de uma caixa fixa de 450 px. O efeito é equivalente e não
reflowa a página. Se um dia for para igualar, é aqui.

### Correção ao handoff anterior

`_capturas/_videos/servicos.desktop.acordeao-servicos.webm` **não existe**. O
acordeão foi capturado em **`sobre-nos`**; `/servicos` só tem
`cta-antes-do-rodape` e `reveal-entrada`.

---

## 3. O blog seguindo o Framer — **FEITO**

O herói do Framer tem **dois** blocos, não um, e faltava o segundo inteiro:

| | Framer | Antes | Agora |
|---|---|---|---|
| rótulo | "Blog" 60px Mulish 600, à esquerda | era o `<h1>` | `<p>`, mantido |
| manchete | **64px Manrope 500**, centralizada, tracking −0.06em | **não existia** | é o `<h1>` |

A manchete é "Dicas e notícias para quem realmente se destaca."

A **Manrope** já estava em `fontes.css`, servida do próprio domínio, sem uso
em lugar nenhum — agora é usada e **entrou no `tools/valida-fontes.mjs`**
(13 famílias, todas passam).

O site continua sem **nenhuma** requisição externa no navegador do visitante,
como a Política de Cookies promete.

⚠️ `src/styles/artigo.css` continua com o aviso de não editar por gosto — foi
medida contra a captura e não foi tocada.

---

## 4. O CMS — **FEITO**

Decisões do Gabriel (07/09/2026): **Supabase**, **dois acessos** (Isabella e
Gabriel), e — deixado a meu critério — **rebuild por webhook**, porque o
projeto é `output: 'static'` e o conteúdo muda uma vez por mês.

**O projeto Supabase do `.env` estava vazio** (zero tabelas), apesar das
quatro credenciais válidas. Não havia nada a aproveitar.

O que existe agora:

```bash
node tools/migra-supabase.mjs                  # aplica supabase/migracoes/
node tools/importa-artigos.mjs                 # carga inicial (idempotente)
node tools/cria-editor.mjs <email> "<Nome>"    # cria/redefine acesso
```

- **A promessa do `content.config.ts` foi cumprida:** o `glob()` virou
  `artigosDoSupabase()` e **as páginas não mudaram** — exceto `width`/`height`
  no `<Image>`, que o Astro exige de imagem remota.
- Os 25 artigos e as 25 capas estão no banco. Os markdown em
  `src/content/artigos/` são **acervo**, não são mais lidos no build.
- O painel: `/painel/entrar`, `/painel`, `/painel/artigo`. Fora do sitemap,
  `Disallow` no robots, `noindex` nas três.
- `/api/publica` dispara o Deploy Hook, e **confere que quem pediu é
  editor** antes — a URL do hook é segredo e não vai para o navegador.

### Três armadilhas que já custaram tempo aqui

1. **RLS recursiva.** Política de `editores` que consulta `editores` entra em
   recursão infinita ("infinite recursion detected"). Resolvido com
   `public.e_editor()`, `security definer` (migração 004). **Política nova
   deve usar a função, não um `exists`.**
2. **`innerHTML` não recebe o `data-astro-cid`** do escopo, e o CSS escopado
   não o alcança — a lista do painel saía sem borda e com título de 60px. O
   estilo dela é `is:global` de propósito.
3. **`<Image>` exige `width`/`height` de imagem remota.** Daí
   `capa_largura`/`capa_altura` no banco, medidos no upload.

O corpo do artigo é **HTML**, gravado e servido como HTML — não passa por
`renderMarkdown`, que envolveria linhas soltas em `<p>` e estragaria a
marcação que a `artigo.css` foi medida para estilizar.

### O que falta no CMS

- **Entregar a senha à Isabella.** As duas contas existem, mas a senha dela
  foi gerada nesta sessão e **não foi entregue**. Rode
  `node tools/cria-editor.mjs arqisabellapires@gmail.com "Isabella Pires"`
  para gerar outra e passe por canal seguro; ela troca depois.
- **Ninguém testou o painel no celular dela.** Foi conferido em 1280px.
- Um editor de texto rico seria mais gentil que o campo de HTML. Hoje ela
  precisa escrever `<p>` e `<h2>` na mão.
- Apagar artigo não existe no painel (só despublicar).

---

## 5. Os portões

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

Todos passam. **E nenhum deles mede animação** — continua valendo: passar nos
portões não é evidência de que o movimento está certo.

Um portão ficou mais honesto nesta sessão: `audita-paginas` lia título e
descrição do **DOM vivo**, e como as páginas do painel redirecionam para o
login, as três reportavam o título da tela de entrada — uma duplicata que não
existia. Agora lê do arquivo.

---

## 6. Estado do resto

- **No ar:** `www.isabellapiresarquitetura.com.br`, deploy automático a cada
  push na `main`. **Empurrar publica no site oficial.**
- **Os commits desta sessão estão locais.** Confira antes de empurrar.
- **CNPJ:** continua sem existir no código. Não invente número.
- Pendências antigas, ainda intocadas: **Lighthouse** e **Search Console**.

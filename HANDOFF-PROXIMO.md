# Handoff — para quem continua

Escrito em 05/09/2026. **Leia este arquivo inteiro antes de tocar em
qualquer coisa.** Ele é curto de propósito.

Se você só vai ler um outro arquivo depois deste, leia
[docs/HANDOFF-FIGMA.md](docs/HANDOFF-FIGMA.md), que explica *o que já foi
feito e por quê*. Este aqui é *o que fazer agora*.

---

## Em uma frase

Site de arquiteta em Maringá, em Astro, **já no ar** em
`www.isabellapiresarquitetura.com.br`. Acabou de ser reconstruído contra o
Figma da cliente. Está funcionando e verificado; o que falta é a lista da
seção 4.

---

## 1. As cinco coisas que você precisa saber antes de agir

### 1.1. O Figma é a fonte de verdade do layout — e está offline

Arquivo `w03gcodehy5qey828y58hS`, acessível pelo MCP do Figma. **Mas não
dependa dele:** as 7 telas já estão extraídas em `_figma/`, e as URLs de
asset que o Figma devolve **expiram em 7 dias** (as desta rodada já
expiraram). Trabalhe a partir de `_figma/*-medidas.json`, que é a leitura
útil: seção por seção, em português, com padding, gap, fonte, cor.

O Figma **só tem 1920px**. Não há nada de responsivo nele. Tablet e celular
são decisão sua, e a referência secundária são as capturas em
`_capturas/`.

### 1.2. Rode os portões. Todos. Antes de dizer que algo está pronto

```bash
npx astro build                      # 39 páginas
node tools/valida-fontes.mjs         # as 12 famílias carregam no Chromium
node tools/audita-paginas.mjs        # estrutura, metadados, contraste real
node tools/verifica-revela.mjs       # nada fica invisível ao rolar
node tools/verifica-responsivo.mjs   # nada vaza para o lado
node tools/valida-tokens.mjs <arquivo.css>
node tools/tira-foto.mjs [--bp tablet|mobile] [/rota]
```

Em 05/09/2026, com o commit `433ab1e`, **todos passam**.

### 1.3. Portão que nunca falhou é decoração

Esta é a lição mais cara desta rodada, e você vai repeti-la se não ler:
**três dos portões nasceram cegos.**

- `audita-paginas` injetava o HTML sem buscar o CSS externo — media
  contraste com metade do estilo ausente. Consertado, achou um defeito real
  em **156 pontos**.
- `verifica-revela` media só *depois* de rolar, e passava batido justamente
  pelo defeito que existia para pegar.
- `tira-foto` fotografava sem rolar, e como a aparição usa
  `animation-timeline: view()`, tudo abaixo da primeira tela saía **em
  branco**. Isso quase passou por defeito grave de layout.

**Sempre ponha o defeito de propósito dentro e veja o portão reprovar,
antes de confiar nele.**

### 1.4. Texto é do Gabriel

Não invente copy, `alt`, `title` ou `description`. Se faltar texto, pergunte
ou deixe marcado `TODO(gabriel)`. Isso é regra do projeto, não preferência.

### 1.5. O push não funciona

O remote é o repositório **da cliente**
(`arqisabellapires/isabella-pires-arquitetura`). A conta `gabrielfeelix`
tem leitura, **não escrita**:

```
ERROR: Permission to arqisabellapires/... denied to gabrielfeelix.
```

Os 19 commits desta rodada estão **locais**, na `main`. Não gaste tempo
tentando: avise e siga. Para resolver, o Gabriel precisa dar acesso de
escrita à conta ou apontar o remote para um fork dele.

---

## 2. Como o trabalho é feito aqui

- **Commit direto na `main`**, sem branch nem PR. O portão é medido, não
  revisado.
- **Sem datas nem estimativas.** Ordem, dependências e portão de saída.
- **Sem perguntas desnecessárias.** O Gabriel foi explícito: decida e
  execute, registrando o porquê no código. Pergunte só o que for
  genuinamente dele (texto, decisão de negócio, licença).
- **Subagentes só para pesquisa e verificação.** Design e código de layout
  são sempre com você — eles erram. Confira o que devolverem: nesta rodada
  um subagente salvou o arquivo errado (dois design-contexts idênticos,
  pego por `md5sum`) e outro relatou trabalho que não fez.

---

## 3. Mapa rápido do repositório

```
src/styles/
  fontes.css          @font-face das 4 famílias + os alias Faberge/Arboria
  tokens.figma.css    88 tokens do design — é o que manda
  motion.css          as 17 molas do Framer em linear() (GERADO)
  revela.css          a aparição ao rolar
  tokens.css          tokens antigos; tokens.figma vem depois e vence
  tokens.derivados.css  33 KB medidos das capturas — NÃO é importado

src/components/       Cabecalho, Rodape, Wordmark, RotuloSecao, Migalhas,
                      FeedInstagram, artigos/CardArtigo, formularios/*
src/lib/conteudo.ts   todo o texto das páginas
src/lib/site.ts       dados da empresa, navegação, rodapé, redirects

_figma/               as 7 telas extraídas + *-medidas.json (a leitura útil)
_capturas/            45 capturas do Framer + motion-fichas.json (17 molas)
tools/                os portões e utilitários
```

**Regenerar o motion:** `node tools/mola-para-css.mjs --escreve`.
Nunca edite `motion.css` à mão.

---

## 4. O que fazer a seguir, em ordem

### Primeiro: conferir com o Gabriel

Ele ainda **não viu** o resultado desta rodada. Antes de construir mais
qualquer coisa, mostre. `node tools/tira-foto.mjs` gera as fotos; o dev
server é `npx astro dev`.

É bem possível que ele peça ajustes de design — e ajuste pedido por ele vale
mais do que qualquer item abaixo.

### Segundo: as pendências que dependem dele

1. **Os 20 `alt`** de imagem de projeto, em `src/content/projetos/*.md`,
   marcados `TODO(gabriel)`. Texto é dele.
2. **As três páginas de política** (Termos, Privacidade, Cookies). Hoje são
   texto sem link no rodapé (`href: null` em `site.ts`), porque link
   quebrado é pior. Política jurídica não se inventa.
3. **As licenças de Faberge e Arboria**, se ele quiser as fontes originais.
   Hoje são Cormorant Garamond e Jost, sob alias — trocar é mexer no `src`
   de dois `@font-face` e mais nada.

### Terceiro: medir velocidade

O plano pede Lighthouse ≥ 95 e isso **nunca foi medido**. Instalar é
decisão do Gabriel (dependência grande). O `audita-paginas` mede tudo menos
velocidade.

### Quarto: SEO fora do código

GA4 (falta o identificador), Search Console, e o mais valioso para
"arquitetura em Maringá": **o Perfil da Empresa no Google** da Isabella.

### Depois: o CMS de blog

**Módulo à parte**, decidido em 05/09/2026: um painel para a Isabella
escrever sozinha, pensado para ser reutilizável em outros sites do Gabriel.
Desenho em `docs/superpowers/specs/`. **Não misture com o trabalho de
layout** — é outro projeto, e o Gabriel foi explícito quanto a isso.

---

## 5. Armadilhas registradas

Cada uma custou tempo de verdade. Estão em `docs/ENTENDA-O-PROJETO.md` §6
com mais detalhe; aqui vai o essencial:

- **"Parece certo" não é verificação.** CSS inválido é descartado em
  silêncio pelo navegador. Foi assim que 517 definições sumiram sem erro, e
  que o site inteiro rodou com a fonte errada carregando corretamente.
- **Medida serve para geometria, não para texto.** O arquivo de medidas
  quebra parágrafo com negrito e perde palavras. Texto vem do HTML da
  captura ou do `conteudo.ts`.
- **Antes de rodar algo demorado, teste num caso que deve falhar.** O
  gravador de vídeos rodou 133 vezes e só 5 pegaram movimento, porque tinha
  sido testado num caso que já funcionava.
- **Defeito de contraste só a tela revela.** Duas vezes já foi ao ar texto
  invisível (título marrom sobre preto, menu branco sobre bege).
- **`Segoe UI` no Figma não é design.** É o fallback do computador do
  designer. Onde aparecer, sanear para Mulish — nunca reproduzir. O mesmo
  vale para tamanhos quebrados (31px, 71px): é texto redimensionado à mão.

---

## 6. Decisões já tomadas — não as reabra sem motivo

Estão registradas no código, no arquivo onde valem. Resumo:

| Decisão | Por quê |
|---|---|
| Rodapé `#3a2e26`, não o caramelo | Com `#a98d67` o texto dá 2,70:1 |
| `#a98d67` como texto virou `#8d7252` | Mesmo motivo, meio tom abaixo |
| Três redes sociais, não as cinco do Figma | Só três perfis existem |
| Ficha de projeto sem "Valor" | Decisão de negócio da cliente |
| Categorias reais, não as do Figma | "Especializado" não existe |
| Sem hora no card de artigo | Todas caem no mesmo horário por fuso |
| Duas molas sem uso | `carrossel-projetos` (a grade resolve melhor) e `spinner` (marcada "nao-reproduzir") |
| Filtros e "Carregar mais" sem JavaScript | `<input radio>` + `<details>`; o Google indexa tudo |

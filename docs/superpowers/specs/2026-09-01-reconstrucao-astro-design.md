# Reconstrução do site em Astro, com o Framer como especificação medida

Spec de design. Aprovada pelo Gabriel em 01/09/2026 (caminho **B**).
O plano de execução deriva daqui; o estado corrente do repositório continua
em [HANDOFF.md](../../../HANDOFF.md).

Sem datas nem estimativas de esforço. O que ordena as fases é dependência e
urgência; cada fase tem entregáveis e um portão de saída objetivo.

---

## 1. Objetivo

Substituir o site estático processado do Framer (`public/*.html`) por um site
em Astro, **componentizado, com um DOM só, semântico e rápido**, que a
cliente não distinga do original — e a partir do qual o Gabriel consiga
mudar qualquer coisa sem medo.

O site novo tem que ser ao mesmo tempo:

1. **Indistinguível** para a Isabella: mesmas cores, fontes, espaçamentos,
   imagens, ordem das seções e movimento, nos três breakpoints.
2. **Melhor onde o original estava errado sem parecer diferente**: headings
   reais, `alt` nas imagens, title/description únicos, dados estruturados,
   responsividade nos pontos onde o Framer quebrava.
3. **Manutenível**: cada seção é um componente com nome; cada valor visual é
   um token com nome; nada de classe `framer-*`, nada de estilo inline.
4. **Rápido e indexável**: Lighthouse ≥ 95 nas quatro categorias em celular;
   sitemap real; JSON-LD; sem JavaScript que não seja movimento ou formulário.

### O que "idêntico" significa aqui (decisão fechada)

Opção **C** da conversa: *indistinguível pela cliente, com liberdade para
corrigir o que está errado no original*. Não é pixel-perfect.

- O portão de pixel (`verifica-fidelidade.mjs`) **continua existindo como
  diagnóstico**: aponta *onde* olhar. Não é juiz.
- O juiz é a comparação **lado a lado** (§5.3), aprovada pelo Gabriel por
  seção e por breakpoint.
- Correções permitidas sem consulta: semântica de HTML, acessibilidade,
  metadados, performance. Qualquer mudança **visível** (espaçamento,
  tamanho, cor, ordem, texto) é decisão do Gabriel, depois que a página
  estiver idêntica — nunca durante a reconstrução.

---

## 2. Ponto de partida

### 2.1. O que existe e é reaproveitado

| Ativo | Onde | Uso na reconstrução |
|---|---|---|
| 45 capturas do Framer (15 páginas × 3 breakpoints), auditadas | `_capturas/<pasta>/` | **Fonte da verdade** de layout, texto e imagem |
| Fonte do Framer desempacotado (116 módulos) | `_fonte-framer/` (fora do git) | Nomes de variante, valores de mola, máquinas de estado |
| Inventário de motion (28 máquinas de estado) | `public/motion.json`, `public/variantes.json`, `public/carrossel.json` | Fichas de movimento (§5.5) |
| Motion já reimplementado e verificado | `public/interacoes.js` | Scroll reveal, hover de card, menu de celular, carrossel (FLIP, 17/17 no `verifica-carrossel.mjs`). **Porta de entrada dos módulos de motion** — vira `src/scripts/` |
| 25 artigos em markdown + 25 capas | `src/content/artigos/` | Coleção `artigos`, pronta |
| Textos dos serviços transcritos | `src/lib/conteudo.ts` | Acordeão e página de serviços |
| Imagens originais (1056 variantes) e WebP | `_referencia/` (fora do git), `public/img/` | Origem para `src/assets/` |
| Fontes self-hospedadas (3 origens) | `public/fontes/` | Ficam |
| Tokens da primeira tentativa | `src/styles/tokens.css` | **Ponto de partida, não fonte**: serão substituídos pelos derivados das medidas (§5.2) |
| APIs de formulário + Brevo | `src/pages/api/`, `src/lib/brevo.ts` | Ficam como estão |
| Pipeline e portões | `tools/*.mjs` | Ficam; ganham os novos de §5 |
| Framer vivo | `https://authentic-learning-761482.framer.app/` | **Vence em 30/09/2026.** Tudo que precisa do original em execução é Fase 0 |

### 2.2. O que está errado hoje e a reconstrução resolve

Medido na home em `public/index.html`:

| Problema | Medida | Efeito |
|---|---|---|
| Três DOMs empilhados (um por breakpoint) | 629 KB de HTML, 786 `<div>` | Navegador baixa e parseia três páginas para mostrar uma |
| CSS inline do Framer | 193 KB em 9 `<style>`, 1.297 `style=""` | Nada é reutilizável; qualquer ajuste é cirurgia em string |
| Sem semântica | 0 `<h1>`, 0 `<h2>` em 10 das 15 páginas; tudo é `<p>` | Google não sabe do que a página trata |
| Metadados iguais | As 5 páginas principais têm o mesmo `<title>` | Nenhuma página concorre por "arquitetura Maringá" |
| Sem dados estruturados | 0 JSON-LD | Sem `LocalBusiness`, sem cidade associada |
| Artigos fora do ar | 20 dos 25 artigos dão 404 no domínio; no Framer respondem | Google derruba as URLs do índice |
| Sitemap 404 | `/sitemap-index.xml` não existe | Descoberta por sorte |
| Metadado do Framer no `<head>` | `framer-search-index` em 15 páginas | Site anuncia a ferramenta que abandonou |

### 2.3. Por que a reconstrução à mão falhou antes, e por que agora converge

`cb20c52`→`821f036` reconstruíram a home de memória e divergiram em 14
pontos (títulos inventados, seções omitidas, números errados). Faltava um
**oráculo**: não havia captura por breakpoint, nem portão de pixel, nem fonte
do Framer. Hoje há os três, mais o Framer vivo. O que ainda não existia e
esta spec cria é o passo **medir antes de escrever** (§5.1): nenhum valor
de CSS sai da cabeça de ninguém.

---

## 3. Alternativas consideradas

| Caminho | Veredito |
|---|---|
| **A. Ficar no HTML processado** — animar o que falta, injetar headings por pós-processamento | Rejeitado. Mantém 629 KB/página, três DOMs, zero componente. O CMS de blog conviveria com HTML congelado. Não é "vitalício", é "adiado". |
| **B. Reconstruir em Astro com o portão como oráculo** | **Escolhido.** Único que entrega os quatro objetivos de §1. |
| **C. Híbrido permanente** — reconstruir só as páginas com componente/CMS, manter o resto estático | Rejeitado como destino: dois cabeçalhos, dois CSS, dois sistemas. Sobrevive como *transição*: B faz cutover página por página (§6, Fase 2). |

---

## 4. Arquitetura alvo

### 4.1. Princípios

- **Astro estático.** `output: 'static'`; só as rotas de API e, mais tarde, o
  painel do CMS rodam sob demanda (`prerender = false`).
- **Um DOM, três media queries.** Os breakpoints são **os do Framer**, mantidos
  exatamente, porque as capturas foram feitas neles:
  `desktop ≥ 1200px`, `tablet 810–1199.98px`, `mobile ≤ 809.98px`.
  Mudar breakpoint é decisão de depois, não de agora.
- **Zero JavaScript por padrão.** Só motion e formulários carregam script, como
  módulos pequenos e independentes.
- **Conteúdo fora dos componentes.** Texto vem de `src/content/` (coleções) ou
  `src/lib/conteudo.ts`; componente não tem string de copy.
- **Todo valor visual é token.** Cor, tamanho de fonte, peso, altura de linha,
  tracking, raio, sombra, espaçamento, largura de contêiner, curva de mola.
- **Nada do Framer sobrevive no HTML final.** O portão verifica: zero `framer-`,
  zero `data-framer-`, zero `style=` fora de custom properties calculadas.

### 4.2. Estrutura

```
src/
  layouts/Base.astro          <html>, <head>, Seo, JsonLd, slots cabeçalho/rodapé
  components/
    Cabecalho.astro           + menu de celular (variante Open)
    Rodape.astro
    Seo.astro                 title/description/canonical/OG por página
    JsonLd.astro              LocalBusiness | Article | BreadcrumbList
    Migalhas.astro
    Botao.astro
    Imagem.astro              envoltório de <Picture> com tamanhos por breakpoint
    home/                     Hero, Servicos, Projetos (carrossel), Depoimentos, Artigos, Contato…
    servicos/                 Acordeao, ItemServico
    projetos/                 CardProjeto, Galeria, Ficha
    artigos/                  CardArtigo, Grade, Filtros de categoria
    formularios/              Contato, Newsletter (progressive enhancement)
  content/
    artigos/                  25 markdown (existe)
    projetos/                 4 markdown + imagens (Fase 2, extraído das capturas)
  lib/
    site.ts                   nome, endereço, telefone, redes, navegação
    conteudo.ts               textos dos serviços (existe)
    seo.ts                    montagem de title/description por rota
  styles/
    tokens.css                DERIVADO de _capturas/*/medidas.*.json (§5.2)
    base.css                  reset, tipografia base, utilitários de contêiner
    motion.css                curvas linear() geradas das molas
  scripts/
    mola.ts                   curvaDeMola() → CSS linear() e keyframes (vem de interacoes.js)
    reveal.ts                 scroll reveal
    variantes.ts              troca de estado por atributo data-estado (não por classe framer-v-*)
    carrossel.ts              FLIP (vem de interacoes.js)
    acordeao.ts
    menu.ts
    formulario.ts             (vem de formularios.js)
  pages/
    index.astro
    sobre-nos.astro
    servicos.astro
    contato.astro
    projetos/index.astro, [slug].astro
    artigos/index.astro, [slug].astro, categoria/[categoria].astro
    api/contato.ts, api/newsletter.ts (existem)
public/
    fontes/, img (só o que não passa por astro:assets: favicons, OG), robots.txt
tools/
    (existentes) + extrai-medidas, deriva-tokens, compara, verifica-secao,
    verifica-comportamento, grava-interacoes, extrai-projetos, mapeia-imagens
```

O que é do Framer (`_capturas/`, `_fonte-framer/`, `_referencia/`) é
**somente leitura** durante toda a reconstrução.

### 4.3. Imagens

- Originais saem de `_referencia/framerusercontent.com/images/` (maior variante
  disponível) para `src/assets/<pagina>/<secao>-<n>.<ext>` com nomes legíveis.
  `mapeia-imagens.mjs` gera a tabela `id do Framer → caminho semântico` a
  partir da posição da imagem na captura (página, seção, ordem); o Gabriel
  renomeia o que quiser depois, a tabela é a fonte.
- Renderização por `astro:assets` (`<Picture>`), formatos AVIF + WebP, larguras
  por breakpoint copiadas do `sizes`/`srcset` que o Framer usava — são fatos
  medidos, estão nas capturas.
- `alt` obrigatório no schema. O texto é do Gabriel: `mapeia-imagens.mjs`
  produz a lista de imagens sem `alt` e ele preenche; até lá `alt=""` só
  para decorativas, nunca para imagens de projeto.
- OG image e favicons ficam em `public/`.

### 4.4. Motion

Os valores são fatos do design, já extraídos (`motion.json`, fonte do
Framer). A implementação é própria; o que se copia é o número.

| Interação | Fonte do valor | Implementação |
|---|---|---|
| Scroll reveal | `interacoes.js` (bounce .2, 0,8 s; translateX −150 → 0; opacity) | `reveal.ts` + `IntersectionObserver`, keyframes de mola |
| Hover de card de projeto | `variantes.json` (557 → 367 px) | CSS puro `:hover` + `:focus-within`, transição com `linear()` |
| Menu de celular | `variantes.json` (59 → 223 px) | `menu.ts` alterna `data-estado="aberto"`; CSS faz o resto |
| Carrossel de projetos | `carrossel.json` (cycleOrder, spring bounce .2 / .4 s) | `carrossel.ts`, FLIP — o código atual, sem `framer-v-*` |
| Acordeão de serviços | `motion.json` (`n8yL1JHdr`, `i15JnwUan`, `f4n4OEmqR`; spring bounce .2 / .4 s) | `acordeao.ts` + `<details>`/`aria-expanded`; conteúdo de `conteudo.ts` |
| Estados de formulário | `motion.json` (`e8xPPqHpl`: success/error/loading/disabled) | `formulario.ts` |

Regras:
- Mola vira **CSS `linear()`** gerado por `mola.ts` (a partir de `curvaDeMola()`),
  não `cubic-bezier` aproximado. Cobertura ~87%; fallback é `ease-out`.
- `prefers-reduced-motion: reduce` desliga tudo — estado final direto.
- Estado é **atributo** (`data-estado`), nunca classe gerada pelo Framer.
- Toda interação tem ficha (§5.5) e passa no `verifica-comportamento.mjs`.
- **Não inventar movimento.** Medido: hover só existe no card de projeto.
  Links, botões e imagens não têm hover no original.

### 4.5. SEO e semântica (o que muda sem parecer diferente)

- Um `<h1>` por página; hierarquia `h2`/`h3` seguindo a hierarquia visual que
  a captura já mostra (tamanho/peso). O texto não muda; a tag muda.
- `<title>` e `description` únicos por rota, com serviço + cidade, montados em
  `seo.ts` a partir de `site.ts`. Texto final é do Gabriel; a spec só exige
  que sejam únicos e que citem Maringá onde faz sentido.
- JSON-LD: `LocalBusiness` (tipo `ArchitectureFirm`… confirmar vocabulário
  disponível no schema.org na hora) em todas as páginas, com endereço,
  telefone, área atendida; `Article` nos artigos; `BreadcrumbList` onde há
  migalhas.
- `canonical`, OG/Twitter por página, `lang="pt-BR"`, `robots.txt`, sitemap
  gerado pelo `@astrojs/sitemap` (passa a funcionar porque agora existem
  páginas em `src/pages/`).
- 301 dos slugs antigos: `tools/paginas.mjs` (páginas) + `slugAntigo` dos
  artigos → `vercel.json`.
- Remover `framer-search-index` e `generator: Framer`.
- Acessibilidade mínima: `alt`, foco visível, `aria-expanded` no menu e no
  acordeão, `aria-current` na navegação, contraste conforme o original (se o
  original falha em contraste, registrar; corrigir é decisão visível).

### 4.6. Performance

Alvos por página, em celular, no `astro preview` e depois no domínio:

| Métrica | Alvo |
|---|---|
| Lighthouse Performance / A11y / Best Practices / SEO | ≥ 95 cada |
| HTML por página | < 60 KB (hoje 250–630 KB) |
| JS por página | < 15 KB comprimido, só motion + formulário |
| LCP | < 2,5 s em 4G simulado |
| CLS | < 0,05 (imagens com `width`/`height`, fontes com `font-display: swap` + preload da fonte de corpo) |

`tools/audita-lighthouse.mjs` está referenciado em `package.json` mas não
existe; a Fase 3 cria.

---

## 5. O método de fidelidade

É a parte que faz B convergir. Ordem obrigatória por seção: **medir →
escrever → comparar → aprovar**.

### 5.1. `extrai-medidas.mjs` — a captura vira especificação

Entrada: `_capturas/<pasta>/` nos três breakpoints, servidos localmente
(`servidor.mjs`), abertos em Playwright na largura do breakpoint.

Saída: `_capturas/<pasta>/medidas.<bp>.json`, uma entrada por elemento
**visível** da árvore ativa daquele breakpoint:

```json
{
  "caminho": "main > div:nth-of-type(2) > … ",
  "nomeFramer": "Hero Desktop",              // data-framer-name, quando há
  "tag": "p",
  "texto": "Arquitetura que traduz…",         // normalizado, até 120 chars
  "caixa": { "x": 96, "y": 412, "w": 624, "h": 88 },
  "fonte": { "familia": "Cairo Play", "tamanho": 56, "peso": 600, "alturaLinha": 1.1, "tracking": -0.02 },
  "cor": "rgb(52, 31, 4)",
  "fundo": "rgba(0, 0, 0, 0)",
  "padding": [0, 0, 0, 0], "margem": [0, 0, 24, 0], "gap": 16,
  "raio": 0, "sombra": "none", "opacidade": 1, "transform": "none",
  "imagem": { "src": "…", "srcset": "…", "sizes": "…", "objectFit": "cover" }
}
```

Regras:
- Só a árvore do breakpoint ativo (`[data-bp]` visível), como o
  `interacoes.js` já faz.
- Ignora elementos sem caixa ou com área < 4 px².
- **Caixa é o dado principal.** É o que o portão de seção compara e o que
  o agente usa para acertar largura de contêiner, alinhamento e ritmo
  vertical. Fonte, cor e espaçamento explicam *por que* a caixa é aquela.
- Estado em repouso: reveals concluídos (o script espera os `opacity: 0`
  virarem 1, ou força `prefers-reduced-motion`).
- Determinístico: rodar duas vezes dá o mesmo arquivo. É versionado.

### 5.2. `deriva-tokens.mjs` — os tokens saem da máquina

Lê todos os `medidas.*.json`, agrupa valores distintos e propõe
`src/styles/tokens.css`:

- Cores: as distintas (esperado < 15), nomeadas por papel (`--cor-fundo`,
  `--cor-tinta`…) — o nome é do Gabriel, o valor é da medida. Os tokens
  atuais servem de mapa de nomes; valores que não batem são substituídos.
- Tipografia: pares (família, tamanho, peso, altura de linha, tracking) por
  breakpoint → escala nomeada (`--texto-titulo-1`…), **um valor por
  breakpoint**, não `clamp()`. `clamp()` é decisão de depois: hoje o
  original salta entre três valores e é isso que a captura mostra.
- Espaçamento: distâncias verticais entre caixas consecutivas → escala
  quantizada (múltiplos de 4 px); as que não quantizam ficam como valor
  literal com comentário.
- Raios, sombras, larguras de contêiner: as distintas.
- Molas: de `motion.json`, cada par (bounce, duração) vira `--mola-<nome>`
  com `linear()` gerado.

O arquivo gerado tem cabeçalho "gerado por deriva-tokens.mjs, edite os
nomes, não os valores".

### 5.3. `compara.mjs` + `compara.html` — o que o Gabriel olha

Página local com dois `<iframe>` lado a lado, mesma largura: **esquerda a
captura do Framer**, **direita o Astro** (`astro dev` ou `preview`).

- Seletor de breakpoint (390 / 1000 / 1440) redimensiona os dois.
- Scroll sincronizado.
- Botão "sobrepor": empilha os dois com opacidade 50% — mostra deslocamento
  sem pintar nada de vermelho.
- Botão "diferença": só então mostra o mapa do portão, com o percentual, para
  quem quiser.
- Lista lateral de seções (dos `data-secao` do Astro) com o percentual de
  cada uma (§5.4); clicar rola os dois.

Aceitação de seção = o Gabriel olha os três breakpoints aqui e diz "igual".
Fica registrado no PR como checklist marcada.

### 5.4. `verifica-secao.mjs` — portão por seção

Generaliza o `verifica-fidelidade.mjs`:

- Cada componente de seção tem `data-secao="hero"`; a captura tem o
  `data-framer-name` ou o caminho equivalente registrado em
  `_capturas/<pasta>/secoes.json` (mapa seção → seletor no Framer, escrito
  uma vez por página).
- Recorta as duas imagens pela caixa da seção e compara.
- Reporta por seção, por breakpoint: percentual, caixa de maior divergência,
  e as **três maiores diferenças de medida** entre `medidas.json` e o DOM
  do Astro (ex.: "line-height 1.1 vs 1.18 no h1"). Esse texto é o que o
  agente lê para corrigir — sem abrir imagem.
- Limite 0,5 % **sinaliza**, não reprova. Reprova só o que §5.3 reprovar.

Portão de página = todas as seções sinalizadas foram olhadas e aprovadas +
zero `framer-` no HTML + `<h1>` presente + title/description únicos +
Lighthouse ≥ 95 + `verifica-comportamento` verde.

### 5.5. Fichas de movimento e `verifica-comportamento.mjs`

Uma ficha por interação em `_capturas/motion-fichas.json`, preenchida a
partir de `motion.json`, do fonte e da gravação (§5.6):

```json
{
  "id": "acordeao-servicos",
  "pagina": "servicos", "breakpoints": ["desktop", "tablet", "mobile"],
  "gatilho": { "tipo": "click", "alvo": "cabeçalho do item" },
  "de": { "altura": 72 }, "para": { "altura": "conteúdo", "outrosFecham": true },
  "mola": { "bounce": 0.2, "duracao": 0.4 },
  "referencia": "_capturas/_videos/servicos.desktop.acordeao.webm"
}
```

`verifica-comportamento.mjs` (generalização do `verifica-carrossel.mjs`):
dispara o gatilho no Astro, mede a geometria depois de `duracao`, compara
com `para`; mede um quadro intermediário e confere que houve movimento
(não salto). Verde/vermelho por ficha por breakpoint.

### 5.6. `grava-interacoes.mjs` — a referência humana, antes de 30/09

Playwright contra o Framer vivo: para cada ficha, grava vídeo (`webm`) do
gatilho até o repouso, nos três breakpoints, em `_capturas/_videos/`
(fora do git; backup junto com `_fonte-framer/`). É o que o Gabriel abre
quando o verificador diz verde e ele quer ver se *parece* igual.

### 5.7. Definição de pronto

| Unidade | Pronto quando |
|---|---|
| **Seção** | `verifica-secao` rodado nos 3 breakpoints; o Gabriel aprovou no `compara.html`; zero `framer-`; tokens só (sem valor literal sem comentário); textos vêm de conteúdo, não do componente |
| **Interação** | Ficha existe; `verifica-comportamento` verde nos breakpoints da ficha; `prefers-reduced-motion` respeitado; teclado funciona |
| **Página** | Todas as seções prontas; `<h1>`; title/description únicos; JSON-LD; Lighthouse ≥ 95; a rota Astro substitui a pasta em `public/` **no mesmo PR**; 301 se a URL mudou |
| **Site** | 15 rotas + 25 artigos em Astro; `public/*.html` não existe mais; sitemap responde; Search Console sem erro de cobertura |

---

## 6. Fases

Ordem por dependência. Nada de calendário.

### Fase 0 — Antes que algo vença ou caia do índice

Tudo aqui depende do Framer vivo ou é sangramento em produção.

- [x] Tirar a barra "Edit Content" (`92588a9`).
- [ ] `grava-interacoes.mjs` + gravações de **todas** as fichas de §5.5, nos 3
      breakpoints. Inclui reveals de cada página, hover de card, menu,
      carrossel, acordeão, estados de formulário.
- [ ] Fichas de movimento completas (`motion-fichas.json`), revisadas contra
      `motion.json`: os 10 trocadores de conteúdo e os 5 pares têm que estar
      ou numa ficha ou explicitamente marcados "sem efeito visível".
- [ ] Conferir contra o sitemap do Framer (35 URLs) que nada além dos 20
      artigos ficou sem captura. Os artigos compartilham molde; **não**
      precisam de captura individual — o CSV já tem o conteúdo.
- [ ] Backup fora do repositório de `_fonte-framer/`, `_capturas/_runtime/`,
      `_referencia/`, `_importar/`, `_capturas/_videos/`. Registrar onde.
- [ ] **Estancar os 404**: `/artigos/[slug]` em Astro é o primeiro item da
      Fase 2 por isso. Enquanto não sobe, `vercel.json` recebe 302 de cada
      slug de artigo para `/artigos/` — melhor que 404 para o índice.
- [ ] Sitemap provisório estático com as 15 páginas; submeter no Search
      Console (criar a propriedade se não existe; é da conta da Isabella).

**Portão de saída:** todas as gravações existem e abrem; backup verificado
(listar, não confiar); nenhuma URL do sitemap do Framer responde 404 no
domínio.

### Fase 1 — Fundação: provar o método no cabeçalho e no rodapé

Cabeçalho e rodapé estão em todas as páginas. Se passam, o método passa.
Se não passam, o problema é do método e é aqui que se conserta — não na
página.

- [ ] `extrai-medidas.mjs` rodado nas 15 páginas × 3 breakpoints; JSONs
      versionados.
- [ ] `deriva-tokens.mjs` → `tokens.css` novo; o Gabriel nomeia.
- [ ] `compara.mjs`/`compara.html` funcionando contra `astro dev`.
- [ ] `verifica-secao.mjs` funcionando; `secoes.json` da home escrito.
- [ ] `Base.astro` limpo (o atual tem GA4/Clarity; mantém), `Seo.astro`,
      `JsonLd.astro`.
- [ ] `Cabecalho.astro` reconstruído das medidas, com menu de celular
      (`menu.ts`), aprovado nos 3 breakpoints. O componente atual da
      primeira tentativa é referência de estrutura, não de valores.
- [ ] `Rodape.astro`, idem.
- [ ] `mola.ts` gerando `linear()`; `motion.css`.
- [ ] Doc curta `docs/reconstruir-uma-secao.md`: o passo a passo medir →
      escrever → comparar → aprovar, com os comandos. É o que os agentes leem.
- [ ] Apagar `src/components/Formulario.astro` e o que mais sobrou da
      primeira tentativa e não for reaproveitado.

**Portão de saída:** cabeçalho e rodapé aprovados no `compara.html` nos 3
breakpoints; `verifica-secao` abaixo de 0,5 % neles ou divergência explicada
e aceita; menu verde no `verifica-comportamento`.

### Fase 2 — Páginas, uma por vez, com cutover

Cada página é um PR. Ao passar no portão de página, a pasta correspondente
em `public/` é apagada **no mesmo PR** e a rota Astro assume. Produção
nunca fica sem a página.

Ordem, por urgência × valor:

1. **`/artigos/[slug]` + `/artigos/`** — fecha os 20 404s. Molde do artigo
   sai da captura das 5 páginas de artigo (compartilham layout). A listagem
   é a única página que o portão de pixel nunca vai aprovar (a referência
   muda de altura a cada carga porque buscava do CMS); aceitação só por
   `compara.html`. Inclui páginas de categoria e a ligação do formulário
   de newsletter.
2. **Home** — Hero, serviços, carrossel (`carrossel.ts`), artigos recentes,
   contato. Reveals.
3. **`/servicos/`** — acordeão com `conteudo.ts`. É a primeira vez que o
   painel aberto existe no DOM.
4. **`/projetos/` + `/projetos/[slug]`** — `extrai-projetos.mjs` lê as 4
   capturas de projeto e escreve `src/content/projetos/<slug>.md` + imagens
   em `src/assets/projetos/<slug>/`. Cards com hover. Coleção `projetos` já
   tem schema em `content.config.ts`.
5. **`/sobre-nos/`**.
6. **`/contato/`** — formulário em `formulario.ts`, endpoint existente. As
   quatro pendências externas da Brevo (IPs, destino, DKIM, lista) ficam
   listadas no HANDOFF; a página fica pronta e o envio real é destravado
   quando o Gabriel resolver.

Ao fim: `public/` só tem `fontes/`, `robots.txt`, favicons, OG, e mais
nada de HTML.

**Portão de saída:** 15 rotas + 25 artigos servidos por Astro; nenhum
`index.html` em `public/`; `verifica-comportamento` verde em todas as fichas;
o Gabriel aprovou cada página.

### Fase 3 — SEO local, performance, lançamento

- [ ] Title/description por rota (texto do Gabriel; a spec dá o molde:
      `<serviço/página> | Isabella Pires Arquitetura · Maringá`).
- [ ] `LocalBusiness` com dados de `site.ts` (endereço, telefone, horário,
      área atendida: Maringá e região — confirmar com a Isabella).
- [ ] `Article` + `BreadcrumbList`.
- [ ] Sitemap real; `robots.txt` apontando para ele.
- [ ] 301 dos slugs antigos (páginas e 12 artigos com `slugAntigo`); tirar
      os 302 provisórios da Fase 0.
- [ ] GA4 + Clarity (variáveis já previstas em `Base.astro`; faltam os IDs).
- [ ] `audita-lighthouse.mjs` criado; ≥ 95 nas 15 rotas + 3 artigos de
      amostra, em celular.
- [ ] `alt` de todas as imagens (lista de `mapeia-imagens.mjs`, texto do
      Gabriel).
- [ ] Limpar `framer-search-index`, `generator`.
- [ ] Search Console: sitemap enviado, cobertura sem erro, 301 reconhecidos.
- [ ] Dependência externa, tarefa da Isabella: **Perfil da Empresa no
      Google** com o site, telefone e categoria "Arquiteto". É o item de
      maior efeito para "arquitetura Maringá" e não é trabalho de código.
- [ ] Tornar o repositório privado **ou** manter o que é do Framer fora dele
      (já está). Decisão registrada no HANDOFF.

**Portão de saída:** Lighthouse ≥ 95 em tudo; Search Console verde;
`curl` de cada URL antiga devolve 301 para a nova; o Framer pode vencer
sem que nada no site dependa dele.

### Fase 4 — CMS de blog reutilizável

Sub-projeto com spec própria:
[2026-09-01-cms-blog-reutilizavel-design.md](2026-09-01-cms-blog-reutilizavel-design.md).
Depende da Fase 2 (as páginas de artigo em Astro são o consumidor) e é
independente da Fase 3.

### Fase 5 — Conteúdo com intenção local

- Pauta: a Fase 4 entrega no painel um checklist editorial; os próximos
  posts miram busca local ("reforma de apartamento em Maringá", "quanto
  custa projeto arquitetônico em Maringá", "arquiteta para casa em
  condomínio em Maringá"…). Os 25 atuais são genéricos e nacionais; não se
  reescrevem, ganham interlinks e, onde couber, um parágrafo local.
- Meta declarada: 40 posts. Texto é da Isabella/Gabriel.

---

## 7. Regras para os agentes

1. **Medir, não olhar.** Valor de CSS vem de `medidas.<bp>.json` ou de
   `tokens.css`. Se não está lá, mede-se primeiro. Nunca "parece uns 24px".
2. **Texto é do Gabriel.** Não inventar copy, alt, title, description. Se
   falta, extrair da captura ou deixar `TODO(gabriel)` e listar no PR.
3. **Uma seção (ou uma interação) por PR.** O PR traz: saída do
   `verifica-secao`, checklist de aprovação no `compara.html` por breakpoint,
   saída do `verifica-comportamento` quando há interação.
4. **`_capturas/`, `_fonte-framer/`, `_referencia/` são somente leitura.**
   Recapturar só na Fase 0, e só do Framer (`audita-capturas.mjs`).
5. **Nada de `framer-*` no resultado.** O portão de página falha se achar.
6. **Não inventar movimento.** Só o que tem ficha. Hover só no card.
7. **Não mudar o que é visível** durante a reconstrução. Achou algo feio no
   original? Anota em `docs/melhorias-depois.md`, reproduz igual, segue.
8. **Auditar todo arquivo versionado antes de commitar.** Já houve token
   real em `.env.example`. Nada de credencial, nada de arquivo do Framer.
9. **Não reabrir decisão da tabela do HANDOFF** (§5 de lá) sem o Gabriel.
10. **Ler `docs/reconstruir-uma-secao.md` antes de tocar em componente.**

---

## 8. Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Framer vence antes de a Fase 0 terminar | Fase 0 é a primeira coisa a rodar; gravações e backup vêm antes de qualquer componente |
| Fontes renderizam diferente (hinting, sub-pixel) e o portão sinaliza tudo | Limite de 0,5 % é sinal, não reprovação; `compara.html` "sobrepor" mostra se é deslocamento ou textura. Fontes são os mesmos arquivos |
| `/artigos/` nunca bate no portão (referência não determinística) | Aceitação só por lado a lado; registrado como exceção conhecida |
| Três DOMs → um DOM: o Framer tinha conteúdo diferente por breakpoint em alguns componentes | `medidas.json` por breakpoint expõe isso; onde o conteúdo difere, o componente recebe `slot` por breakpoint e CSS esconde, nunca DOM triplicado |
| A primeira tentativa de reconstrução (`src/components/`) contamina com valores de memória | Componentes antigos são estrutura de referência; todo valor vem dos tokens derivados. `verifica-secao` pega o que escapar |
| Vercel Hobby em site comercial | Risco já aceito no HANDOFF; mitigação é `@astrojs/cloudflare` |
| Conversão de imagens estoura memória (aconteceu com `otimiza-imagens.mjs`) | `astro:assets` processa sob demanda no build; `mapeia-imagens.mjs` copia originais em lotes com `sharp` limitado a 1 concorrência |
| Brevo travada por IP/DKIM | Fora do código; página de contato fica pronta e o HANDOFF lista o que o Gabriel precisa fazer na Brevo e no registro.br |

---

## 9. Fora de escopo desta spec

- Redesign, mudança de breakpoint, `clamp()`, cursor customizado, ilustrações
  novas — tudo "depois de idêntico", em `docs/melhorias-depois.md`.
- Painel/CMS: spec própria (Fase 4).
- Tráfego pago, redes sociais, backlinks.
- Multi-idioma.

---

## 10. Ferramentas: existentes e novas

| Script | Estado | Papel |
|---|---|---|
| `paginas.mjs` | existe | Tabela única de páginas e breakpoints |
| `captura-breakpoints.mjs`, `audita-capturas.mjs`, `funde-breakpoints.mjs`, `baixa-variantes.mjs`, `processa-framer.mjs`, `otimiza-imagens.mjs` | existem | Pipeline do site estático — **congelado**; some com a Fase 2 |
| `verifica-fidelidade.mjs`, `diagnostica-diferenca.mjs` | existem | Diagnóstico de página inteira; `verifica-secao` os generaliza |
| `extrai-variantes.mjs`, `inventario-motion.mjs`, `sonda-carrossel.mjs`, `verifica-carrossel.mjs` | existem | Motion: fatos e portão do carrossel |
| `servidor.mjs` | existe | Servir capturas |
| `importa-framer.mjs`, `baixa-capas.mjs`, `baixa-imagens-do-corpo.mjs` | existem | Artigos, concluído |
| **`grava-interacoes.mjs`** | Fase 0 | Vídeos de referência do Framer vivo |
| **`extrai-medidas.mjs`** | Fase 1 | Captura → `medidas.<bp>.json` |
| **`deriva-tokens.mjs`** | Fase 1 | Medidas → `tokens.css` |
| **`compara.mjs`** | Fase 1 | Lado a lado para aprovação |
| **`verifica-secao.mjs`** | Fase 1 | Portão por seção, com diferenças de medida em texto |
| **`verifica-comportamento.mjs`** | Fase 1 | Portão de interação, por ficha |
| **`mapeia-imagens.mjs`** | Fase 2 | id do Framer → `src/assets/…`, lista de `alt` faltando |
| **`extrai-projetos.mjs`** | Fase 2 | Capturas de projeto → coleção `projetos` |
| **`audita-lighthouse.mjs`** | Fase 3 | Métricas por rota |

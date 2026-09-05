# Plano de execução — o Figma vira a fonte de verdade

Escrito em 05/09/2026, depois de ler `docs/ENTENDA-O-PROJETO.md`, abrir o
Figma pelo MCP e medir o repositório e o site no ar.

Este documento **substitui a estratégia de "medir a captura do Framer"**
como fonte primária de design. Ele não descarta o trabalho anterior: as
capturas continuam mandando em texto, e as fichas de motion continuam
mandando em animação. O que muda é quem manda no **layout**.

---

## 1. Por que a reconstrução não convergiu

Não foi falta de esforço. Foram quatro defeitos que não emitem erro, e que
eu medi hoje. Cada um explica uma parte da sensação de "está diferente".

### 1.1. Três das quatro fontes do design não carregam

O design usa **Faberge, Arboria, Montserrat e Mulish**. O `fontes.css`
declara `@font-face` para **Mulish apenas** — 17 vezes. Para as outras três:
zero.

A Faberge é a mais grave: é a fonte dos títulos display, medida em
**100px/120px** e presente **71 vezes** nas capturas. Ela é usada em 4
páginas do site novo (`index`, `servicos`, `sobre-nos`, `contato`) e **em
nenhuma delas ela existe**. Todo título grande do site está caindo em
`sans-serif` do sistema.

**Rodei a verificação** (`tools/identifica-fontes.mjs`, novo): abri as 75
fontes em disco com `fontkit` e li o nome interno de cada uma. O resultado
fecha o diagnóstico:

| Famílias em disco | Arquivos |
|---|---|
| Inter (+ Display, Medium, SemiBold, Black) | 73 |
| Manrope (SemiBold, Medium) | 2 |

**Faberge, Arboria e Montserrat não estão em disco. Nenhuma delas.** E o
`fontes.css` está *íntegro* — os 97 arquivos que ele aponta existem — só que
carrega **59 declarações de Inter**, uma fonte que o design não usa, e
nenhuma das três que ele usa.

Ou seja: o site não está com fontes quebradas. Está com **as fontes erradas,
carregando corretamente**. É por isso que nenhuma trava pegou.

Onde cada uma pode ser obtida:

- **Montserrat** — Google Fonts, livre. Resolvido, é só baixar.
- **Faberge** — não está no Google Fonts (404) e não veio nas capturas. No
  Framer vinha de `framerusercontent.com` sob nome interno. **Precisa ser
  obtida do Figma ou licenciada.**
- **Arboria** — comercial (Adobe/Typekit). **Precisa de licença.**

> Isto sozinho muda a página inteira. Tipografia é o que dá caráter a um
> site de arquitetura, e o caráter está desligado.

### 1.2. A especificação medida nunca foi ligada

`src/styles/tokens.derivados.css` tem **33 KB de valores extraídos das 45
capturas** — cores com procedência, escalas tipográficas por breakpoint.

Ele **não é importado em lugar nenhum**. O `Base.astro` importa
`fontes.css`, `tokens.css` e `base.css`. O arquivo que era o resultado de
todo o método de medição está morto no repositório.

### 1.3. As páginas não usam tokens

Medido por arquivo — ocorrências de `NNpx` escritas à mão contra usos de
`var(--token)`:

| Página | px à mão | tokens |
|---|---|---|
| `index.astro` | 66 | **0** |
| `sobre-nos.astro` | 55 | **0** |
| `servicos.astro` | 32 | **0** |
| `projetos/index.astro` | 31 | **0** |
| `contato.astro` | 27 | **0** |

Zero. Em todas. É por isso que consertar uma coisa quebra outra: não existe
um lugar único onde a decisão viva.

### 1.4. As animações nunca foram implementadas

`motion` e `lenis` continuam no `package.json` sem uma linha de uso, como o
documento já admitia.

### 1.5. Duas correções de fato ao documento de contexto

- **O site novo já está no ar no domínio oficial.** O
  `ENTENDA-O-PROJETO.md` diz que `www.isabellapiresarquitetura.com.br`
  "continua com o site antigo". Não continua: responde **23 KB de Astro pela
  Vercel**. A cliente já está vendo isto.
- **As rotas do Figma não batem com as do site.** O Figma desenha `/blog` e
  `/sobre`; o site serve `/artigos` e `/sobre-nos`. Hoje `/blog` e `/sobre`
  respondem **404**.

---

## 2. Quem manda em quê

O erro estratégico anterior foi ter **uma fonte de verdade só** — a captura
do Framer — para três coisas diferentes. Cada uma tem uma fonte melhor:

| Assunto | Fonte de verdade | Por quê |
|---|---|---|
| **Layout, tipografia, cor, espaçamento** | **Figma** (`w03gcodehy5qey828y58hS`) | É a intenção do design, em estrutura navegável e nomeada. A captura é a *renderização* do Framer, com as esquisitices dele embutidas. |
| **Animação** | `_capturas/motion-fichas.json` | O Figma não tem motion. As 17 fichas têm mola, duração, bounce, damping, stiffness e atraso, medidos no Framer vivo. |
| **Texto** | HTML das capturas | Armadilha já registrada: a medida quebra parágrafo com negrito e perde palavras. |
| **Conteúdo** | `src/content/` | Já está separado, e funciona. |

O Figma é a virada porque resolve o problema que fez o agente anterior rodar
em círculos: ele não precisava gravar 100 vídeos para descobrir a estrutura
— ela está **declarada**, com nomes, hierarquia e medidas.

### O que o Figma tem, e o que ele não tem

**Tem** (verificado): 7 telas de 1920px, hierarquia completa de frames,
`get_design_context` com medidas exatas (`h-[592px] w-[1344px] px-[332px]
rounded-[16px] top-[223px] left-[288px]`), gaps, radius, cores literais,
assets exportáveis e `data-node-id` rastreável em cada elemento.

**Não tem**, e é honesto dizer:
- **Nenhuma informação responsiva.** Canvas absoluto de 1920. Todo o
  comportamento em tablet e celular é decisão nossa. Aqui as capturas do
  Framer em 1000px e 390px continuam valendo como referência.
- **Nenhuma tela de artigo individual.** A única página de detalhe desenhada
  é a de projeto. O layout do post terá que ser derivado dela ou desenhado.
- **Tokens fracos:** 13 cores e 1 token de tipografia. Zero espaçamento. A
  paleta marrom da marca está tokenizada (`#352005`, `#483b2a`, `#a98d67`,
  `#887769`), o resto é hex solto.
- **Tipografia suja:** aparece `Segoe UI` (fonte de sistema do Windows, é
  fallback do computador do designer, não decisão de design) e tamanhos
  quebrados como 31px e 71px, de texto redimensionado à mão. **Isso precisa
  ser saneado, não copiado.**

---

## 3. O mapa das telas

| nodeId | Figma | Rota no site | Situação |
|---|---|---|---|
| `1:176` | Homepage | `/` | existe, divergente |
| `1:548` | Nossos Serviços | `/servicos` | existe, divergente |
| `1:762` | Frame 3048 | `/projetos` | existe, divergente |
| `1:954` | Frame 3121 | `/projetos/[slug]` | existe, divergente |
| `1:1093` | Frame 3055 | `/artigos` (Figma diz `/blog`) | existe, rota diverge |
| `1:1363` | Frame 3098 | `/sobre-nos` (Figma diz `/sobre`) | existe, rota diverge |
| `1:1643` | Frame 3058 | `/contato` | existe, divergente |
| — | **não existe** | `/artigos/[slug]` | **sem design** |

Componentes que se repetem nas 7 telas e por isso vêm primeiro: **menu topo**
e **rodapé** (com o wordmark gigante "ISABELLA PIRES" acima dele).

---

## 4. As fases

Sem datas, por dependência, com portão medido em cada uma — no formato que
já está em uso no projeto.

### Fase A — Devolver a tipografia (bloqueia tudo)

Nada adianta acertar espaçamento enquanto a fonte dos títulos não existe.

1. ~~Identificar as fontes em disco~~ — **feito**. `tools/identifica-fontes.mjs`
   rodou e gerou `_capturas/fontes-mapa.json`: são só Inter e Manrope.
2. **Obter as três que faltam.** Montserrat é livre (Google Fonts) e eu baixo.
   Faberge e Arboria dependem de você — ver §5. (**Testei o MCP do Figma:
   ele expõe estilos e variáveis, não o binário da fonte. Não dá para
   extrair o arquivo por ali.**)
3. Escrever os `@font-face` que faltam e **remover as 59 declarações de
   Inter**, que só pesam.
4. **Portão:** um script que abre o site num navegador real e confirma, por
   `document.fonts.check()`, que cada família declarada de fato carregou. O
   mesmo tipo de trava que pegou as 97 fontes quebradas antes.

> Se a Faberge não estiver entre as 73 e não for licenciável, é a primeira
> pergunta que eu te faço. Substituir a fonte display muda o site inteiro e
> não é decisão minha.

### Fase B — Reconstruir o sistema de design a partir do Figma

1. `tools/extrai-figma.mjs`: percorre as 7 telas por `nodeId` de seção
   (nunca a tela inteira — estoura o limite de contexto), guarda cada
   `get_design_context` em `_figma/<tela>/<secao>.json`, versionado. **A
   partir daí trabalhamos offline**, sem depender do MCP nem das URLs de
   asset, que expiram em 7 dias.
2. Baixar os assets do Figma **antes de expirarem**.
3. Gerar `src/styles/tokens.figma.css` a partir dessa extração — cor,
   tipografia, espaçamento, radius — com **a escala saneada**: Segoe UI fora,
   31px e 71px arredondados para a escala.
4. **Importar o arquivo no `Base.astro`.** E decidir o destino do
   `tokens.derivados.css`: ele vira a referência de tablet/celular (que o
   Figma não tem) ou sai do repositório. O que não pode é continuar morto.
5. **Portão:** `valida-tokens.mjs` (que já existe) rodando sobre o arquivo
   novo, e uma contagem que reprove se qualquer página principal continuar
   com px à mão acima de um teto.

### Fase C — Menu e rodapé, os dois componentes de todas as telas

Refazer `Cabecalho.astro` e `Rodape.astro` contra o Figma, incluindo o
wordmark gigante. São a prova do método: se estes dois ficarem certos nas 7
telas, o resto é repetição.

**Portão:** aprovação sua no lado a lado (`tools/compara.mjs`), nos três
tamanhos.

### Fase D — As páginas, uma por uma

Ordem por peso: **Home → Serviços → Projetos (listagem) → Projeto detalhe →
Sobre nós → Contato → Blog**.

Cada página: reescrever o markup e o CSS contra o Figma, usando tokens, com
o texto vindo das capturas. Uma página por commit, e o lado a lado aprovado
antes de seguir.

O responsivo é o ponto de atenção: o Figma só tem 1920. Para tablet e
celular a referência continua sendo a captura do Framer, e onde ela não
resolver, eu pergunto.

### Fase E — As 17 animações

Só depois do layout estar certo — animar um layout errado é trabalho jogado
fora.

As fichas dão os números exatos (ex.: `reveal-entrada` = spring, bounce 0.2,
duração 0.8s, com escalonamento de 0.2/0.4/0.6s; `menu-celular` = damping 40,
mass 1, stiffness 400). Converter cada mola em `linear()` CSS, sem
biblioteca. No fim: `motion` e `lenis` saem do `package.json`, ou passam a
ser usados de verdade.

**Portão:** os 133 vídeos de referência, lado a lado com a implementação.

### Fase F — As pontas soltas

- Decidir as rotas: criar `/blog` e `/sobre` como 301 para as reais, ou
  aceitar a divergência com o Figma.
- Desenhar o layout do artigo individual (não existe no Figma).
- As 20 imagens de projeto sem `alt` — **texto é seu**.
- As três páginas de política.
- Lighthouse, Analytics, Search Console, Perfil da Empresa no Google.

---

## 5. O que eu preciso de você

Em ordem de urgência. Nada aqui me impede de começar a Fase A e a extração
da Fase B — vou tocando isso e paro se esbarrar.

1. **A Faberge.** Confirmado que **não está em disco**. É a fonte dos
   títulos display do site inteiro. Caminhos: (a) você tem o arquivo, (b)
   dá para extrair do Figma, (c) licenciar, (d) escolher uma substituta.
   Sem isso, os títulos continuam em fonte de sistema.
2. **Arboria** — comercial (Adobe). Mesma pergunta. Tem licença?
3. **O rumo.** O `PLANO.md` diz "reproduzir fielmente, melhorar depois". Com
   o Figma na mão, reproduzir **o Figma** é mais barato do que reproduzir o
   Framer, e é o design que você desenhou. Confirma que o alvo é o Figma, e
   não o site antigo?
4. **As rotas** `/blog` e `/sobre`: seguem o Figma ou fica como está?
5. **Um navegador para os portões visuais** — o Playwright não está
   instalado, e sem ele o lado a lado depende de olho. (`fontkit` já
   instalei, e ele já entregou o mapa de fontes.)

---

## 6. O que eu não vou fazer sem você dizer

- Trocar a fonte display por uma substituta.
- Inventar texto, `alt`, título ou descrição.
- Mexer no que está no ar antes de você aprovar o lado a lado.
- Decidir o responsivo onde o Figma cala e a captura não resolve.

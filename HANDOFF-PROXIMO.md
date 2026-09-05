# Handoff — a homepage precisa ser refeita

Escrito em 05/09/2026 pelo agente anterior, depois de o Gabriel apontar que
o resultado ficou desigual. **Ele está certo.** Este documento explica o que
eu errei, por que errei, e o que você precisa fazer.

Leia inteiro antes de tocar em qualquer coisa. É curto.

---

## 1. O erro, em uma frase

**Eu construí a maior parte das seções sem nunca olhar o desenho delas.**

Extraí do Figma o `get_design_context`, que devolve código React/Tailwind, e
tirei dali as medidas — padding, cor, fonte, tamanho. Esses números estavam
certos. Mas número não conta **que forma a seção tem**, e eu não abri a
imagem da maioria delas. Vi o herói, o rodapé e uns recortes. O resto eu
deduzi lendo texto.

Pior: usei **altura de página** como sinal de que estava perto ("94% a 111%
do Figma"). Essa métrica esconde exatamente este erro — três cards
empilhados podem ter a mesma altura de um carrossel. Ela me deu confiança
onde não havia.

---

## 2. O que está errado, confirmado olhando o Figma

Estes três eu **confirmei** comparando a captura do Figma com o que está no
ar. Não são suspeitas.

### 2.1. "Histórias Recentes" — node `1:223`

**No design:** um **carrossel de projetos**. Card central grande e
destacado (817×545, raio 8), as duas peças laterais aparecendo cortadas nas
bordas (451px de altura), três bolinhas de posição embaixo, setas ← e → nas
laterais, e o nome do projeto abaixo — "CASA IP" em Faberge, com
"Maringá - PR" menor embaixo.

**O que eu fiz:** três cards de projeto empilhados na vertical, cada um com
foto de 674px e texto por cima. Nada a ver.

### 2.2. Seção de serviços da home — node `1:300`

**No design:** um **acordeão horizontal de imagens**. O serviço ativo ocupa
um painel largo com a foto inteira e o texto branco sobre ela; os outros
quatro ficam como **faixas verticais estreitas**, cada uma com sua foto e um
número num círculo (1, 2, 3, 4, 5). Há uma seta `>` no painel ativo. O botão
"Solicitar Proposta" fica no alto à direita, alinhado com o título.

**O que eu fiz:** uma grade de texto com o número solto ao lado. Sem
imagens, sem acordeão, sem o botão.

### 2.3. Seção de blog da home — node `1:351`

**No design:** **texto à esquerda, carrossel à direita.** À esquerda o
rótulo "Blog", o título "Arquitetura, Design & **Mercado**" (com "Mercado"
em caramelo), uma linha de apoio e o botão "Acessar blog". À direita, uma
fileira horizontal de **cards verticais** (~230×280), com o título e a data
**sobre a foto**, escorrendo para fora da borda direita — é carrossel.

**O que eu fiz:** um bloco centralizado com título em cima e três cards
horizontais largos embaixo.

### 2.4. O formulário da home — node `1:332`

**No design:** duas colunas. O **cartão do formulário à esquerda** (fundo
branco, raio, sombra suave, campos estreitos) e **o texto à direita** —
rótulo "Entre em contato", título "Vamos conversar sobre seu próximo
projeto?" e um parágrafo de apoio.

**O que eu fiz:** título em cima, formulário embaixo, ocupando a largura
toda. É o que o Gabriel chamou de "form desproporcional".

---

## 3. O que você precisa verificar — eu não verifiquei

**Presuma que toda seção que eu não listei acima também pode estar errada.**
O Gabriel disse "não é só isso, em outros lugares também", e ele tem razão
em desconfiar: meu método falhou de forma sistemática, não pontual.

As seções da home que eu **nunca vi** e portanto não posso garantir:

| Node | O que é |
|---|---|
| `1:189` | "Mais que Design, Um Estilo de Vida" |
| `1:204` / `1:205` | imagem e faixa de parceiros/logos |
| `1:209` | a faixa de números (2024, +32, +10, 100%) |

E as outras seis telas — Serviços, Projetos, Projeto detalhe, Sobre nós,
Contato, Blog — foram construídas **pelo mesmo método**. Eu conferi na tela
apenas: o herói da home, o rodapé, o topo de Serviços, o topo de Projetos,
um trecho de Sobre nós, o formulário de Contato e a grade do Blog. Todo o
resto é suspeito.

---

## 4. Como fazer certo (o método que eu deveria ter usado)

Para **cada seção**, nesta ordem:

1. **Olhe o desenho primeiro.**
   ```
   mcp__figma__get_screenshot(fileKey, nodeId)   → baixe e ABRA a imagem
   ```
   Só depois vá às medidas. A imagem responde "que forma isto tem?"; o
   design context responde "quais os números?". Você precisa das duas, nessa
   ordem.

2. **Construa.**

3. **Fotografe e compare lado a lado.**
   ```bash
   node tools/tira-foto.mjs /rota
   ```
   Depois monte um comparativo empilhando a captura do Figma e a do site
   (tem exemplo de como fazer com `sharp` no histórico do git) e **olhe**.

4. **Só então rode os portões.** Eles verificam contraste, fontes,
   responsivo, acessibilidade — **nenhum deles verifica se o layout está
   certo.** Passar nos portões não significa que está parecido.

**A altura da página não é evidência de fidelidade.** Não use isso.

---

## 5. O que está bom e não precisa ser refeito

Nem tudo está ruim, e refazer o que funciona é desperdício:

- **As fontes.** Das quatro do design, só Mulish carregava; o CSS trazia 73
  faces de Inter, que o design não usa. Corrigido. Faberge e Arboria não são
  livres — entraram Cormorant Garamond e Jost, sob *alias* com o nome
  original, então trocar por licenciadas é mexer em duas linhas.
- **Os tokens** (`src/styles/tokens.figma.css`, 88 valores) e o fato de
  estarem **importados** no `Base.astro`.
- **As 17 molas** do Framer convertidas em `linear()` nativo
  (`src/styles/motion.css`, gerado por `tools/mola-para-css.mjs`).
- **Os portões**, e o conserto de três deles que estavam cegos (ver §7).
- **O contraste.** O rodapé caramelo do design dá 2,70:1 — abaixo do
  legível. Está `#3a2e26` agora. Isso é correção real; não reverta.
- **As imagens**, 43 baixadas do Figma e convertidas para WebP (142 MB → 10
  MB), em `public/imagens/figma/`.

---

## 6. Onde está cada coisa

```
_figma/*-medidas.json     medidas por seção, em português (a leitura útil)
_figma/*-design-context.json   o bruto: React/Tailwind, 33–69 mil chars
                               NUNCA faça cat; leia em fatias com python3
_capturas/motion-fichas.json   as 17 animações medidas no Framer vivo
src/styles/tokens.figma.css    os 88 tokens do design
src/lib/conteudo.ts            todo o texto das páginas
tools/                         portões e utilitários
```

**Figma:** fileKey `w03gcodehy5qey828y58hS`, acessível pelo MCP. As URLs de
asset que ele devolve expiram em 7 dias — por isso as telas foram copiadas
para `_figma/`. Mas **o Figma em si está acessível**: use
`get_screenshot` à vontade, é o que faltou.

Mapa das telas: Home `1:176` · Serviços `1:548` · Projetos `1:762` ·
Projeto detalhe `1:954` · Blog `1:1093` · Sobre nós `1:1363` ·
Contato `1:1643`.

**O Figma só tem 1920px.** Responsivo é decisão sua; a referência secundária
são as capturas em `_capturas/`.

---

## 7. Os portões

```bash
npx astro build                      # 39 páginas
node tools/valida-fontes.mjs         # as 12 famílias carregam no Chromium
node tools/audita-paginas.mjs        # estrutura, metadados, contraste real
node tools/verifica-revela.mjs       # nada fica invisível ao rolar
node tools/verifica-responsivo.mjs   # nada vaza para o lado
node tools/tira-foto.mjs [--bp tablet|mobile] [/rota]
```

Em `c71d963`, todos passam. **E o site ainda assim está errado** — é a
prova de que eles não medem fidelidade.

**Três deles nasceram cegos**, e vale saber porque é o tipo de erro que se
repete:

- `audita-paginas` injetava o HTML sem buscar o CSS externo. Consertado,
  achou um defeito real em 156 pontos.
- `verifica-revela` media só depois de rolar, e passava batido pelo defeito
  que existia para pegar.
- `tira-foto` fotografava sem rolar, e como a aparição usa
  `animation-timeline: view()`, tudo abaixo da primeira tela saía em branco.

Regra: **ponha o defeito de propósito dentro e veja o portão reprovar antes
de confiar nele.**

---

## 8. Regras do projeto

- **Commit direto na `main`**, sem branch nem PR.
- **Sem datas nem estimativas.**
- **Texto é do Gabriel.** Não invente copy, `alt`, `title` ou `description`.
  Se faltar, marque `TODO(gabriel)`.
- **Decida e execute**, registrando o porquê no código. Pergunte só o que é
  genuinamente dele: texto, decisão de negócio, licença.
- **Subagentes só para pesquisa e verificação.** Design e layout são seus.
  Confira o que devolverem — nesta rodada um salvou o arquivo errado (dois
  design-contexts idênticos, pego por `md5sum`) e outro relatou trabalho que
  não fez.
- **O push não funciona.** O remote é o repositório da cliente
  (`arqisabellapires/...`) e a conta `gabrielfeelix` tem leitura, não
  escrita. Os 20 commits estão locais na `main`. Avise e siga.

---

## 9. Decisões já tomadas — não reabra sem motivo

| Decisão | Por quê |
|---|---|
| Rodapé `#3a2e26`, não o caramelo do design | Com `#a98d67` o texto dá 2,70:1 |
| `#a98d67` como texto virou `#8d7252` | Mesmo motivo |
| Três redes sociais, não as cinco do Figma | Só três perfis existem |
| Ficha de projeto sem "Valor" | Decisão de negócio da cliente |
| Categorias reais, não as do Figma | "Especializado" não existe no conteúdo |
| `Segoe UI` do Figma vira Mulish | É o fallback do computador do designer |
| Tamanhos quebrados (31px, 71px) entram na escala | Texto redimensionado à mão |

---

## 10. Por onde começar

1. **Refaça as quatro seções da §2**, uma por vez, olhando o desenho antes
   de escrever código. Comece pelo carrossel de "Histórias Recentes" — é o
   mais visível.
2. **Audite as demais seções da home** (§3) e depois as outras seis telas,
   pelo mesmo método: captura do Figma ao lado da captura do site.
3. **Mostre ao Gabriel** antes de seguir para as pendências. Ele ainda não
   aprovou nenhuma tela, e ajuste pedido por ele vale mais que qualquer item
   de fila.

Pendências que continuam abertas: os 20 `alt` de imagem de projeto
(`TODO(gabriel)`), as três páginas de política, Lighthouse, GA4, Search
Console e o CMS de blog — este último é **módulo à parte**, não misture com
layout.

# Handoff — a rodada do Figma

Escrito em 05/09/2026, ao fim de 19 commits. Para continuar numa sessão
nova sem reler nada: comece por aqui.

## O que aconteceu

O site foi reconstruído tendo o **Figma como fonte de verdade** do layout,
no lugar das capturas do Framer. O arquivo é `w03gcodehy5qey828y58hS`, e as
7 telas estão extraídas para `_figma/` — trabalhe a partir de lá, offline,
porque as URLs de asset do Figma expiram em 7 dias.

**A causa da diferença visual não era o motion.** O documento anterior
culpava as animações. Elas contavam, mas o problema maior era outro: das
quatro fontes que o design usa — Faberge, Arboria, Montserrat, Mulish — só a
Mulish carregava. O `fontes.css` trazia 73 faces de **Inter**, que o design
não usa em lugar nenhum, e nenhuma das outras três. Não dava erro: o arquivo
estava íntegro, apontando para arquivos que existiam. Carregava as fontes
erradas, corretamente.

Junto com isso: o `tokens.derivados.css`, 33 KB de valores medidos, **nunca
era importado**; e as 5 páginas principais usavam **zero tokens**, com 211
valores em px escritos à mão.

## Divisão de fontes de verdade

| Assunto | Fonte |
|---|---|
| Layout, tipografia, cor, espaçamento | **Figma** → `_figma/*-medidas.json` |
| Animação | `_capturas/motion-fichas.json` |
| Texto | HTML das capturas e `src/lib/conteudo.ts` |
| Responsivo | **Decisão nossa** — o Figma só tem 1920px |

## As fontes substitutas

Faberge e Arboria não são livres. Entraram **Cormorant Garamond** e **Jost**,
escolhidas ao olho contra `_figma/refs/wordmark-faberge.png`. Os nomes
originais existem como *alias* em `fontes.css`: quando as licenças chegarem,
troca-se o `src` num lugar só e nenhuma página é tocada.

## Os seis portões

Todos foram provados **com o defeito de propósito dentro**. Rode-os antes de
dizer que algo está pronto:

```bash
npx astro build                      # 39 páginas
node tools/valida-fontes.mjs         # as 12 famílias carregam no Chromium
node tools/valida-tokens.mjs <css>   # o CSS sobrevive ao parser
node tools/audita-paginas.mjs        # estrutura, metadados, contraste real
node tools/verifica-revela.mjs       # nada fica invisível ao rolar
node tools/verifica-responsivo.mjs   # nada vaza para o lado
node tools/tira-foto.mjs [--bp mobile|tablet]   # fotografa o dist servido
```

**Três deles nasceram cegos, e é o aprendizado mais caro desta rodada:**

1. `audita-paginas` usava `setContent`, então o `<link rel=stylesheet>`
   externo nunca era buscado — media contraste com metade do CSS ausente.
   Consertado, encontrou um defeito real em **156 pontos**: o rodapé
   caramelo dava 2,70:1.
2. `verifica-revela` media só depois de rolar a página inteira, e passava
   batido justamente pelo defeito que existia para pegar.
3. `tira-foto` fotografava com `fullPage` sem rolar, e como a aparição usa
   `animation-timeline: view()`, tudo abaixo da primeira tela saía **em
   branco**. Isso quase passou por defeito grave de layout.

A regra que vale para o próximo: **portão que nunca falhou é decoração.**
Ponha o defeito dentro e veja-o reprovar, antes de confiar.

## Onde as telas ficaram

Altura da página contra a altura do Figma:

| Tela | Site | Figma | |
|---|---|---|---|
| Home | 8541 | 7687 | 111% |
| Serviços | 5646 | 5510 | 102% |
| Projetos | 3735 | 3973 | 94% |
| Sobre nós | 6580 | 6773 | 97% |
| Contato | 3279 | 3415 | 96% |
| Blog | 3443 | 3091 | 111% |

## Decisões que tomei sem perguntar

Estão registradas no código, no arquivo onde valem:

- **Rodapé:** o design tem quatro fundos diferentes entre telas. Uniformizei
  no `#3a2e26`, e **não** no caramelo — com `#a98d67` o texto dá 2,70:1.
- **Contraste:** onde `#a98d67` era texto, virou `#8d7252`, meio tom abaixo.
- **Redes sociais:** o Figma desenha cinco; `site.ts` tem três perfis reais.
  Ficaram três — perfil que não existe não vira link.
- **Ficha de projeto:** mantive Ano/Autoria/Localização/Categoria. O Figma
  pede Cliente, Serviço, Tamanho, **Valor** e Data; publicar o valor de um
  projeto é decisão de negócio da cliente.
- **Categorias:** as reais das coleções, não as do Figma.
- **Hora no card de artigo:** fora. Todas as datas caem no mesmo horário por
  conversão de fuso; repetir "21:00" em 25 artigos é ruído.
- **Duas molas sem uso:** `carrossel-projetos` (a grade responsiva resolve
  melhor) e `spinner-carregando-artigos` (marcada "nao-reproduzir").

## O que continua pendente

1. **Os 20 `alt` de imagem de projeto**, marcados `TODO(gabriel)`. Texto é
   seu; não invento.
2. **As três páginas de política** (Termos, Privacidade, Cookies).
3. **Lighthouse, GA4 e Search Console.**
4. **O CMS de blog** — módulo à parte, decidido em 05/09/2026.
5. **O push.** A conta `gabrielfeelix` tem leitura mas **não escrita** em
   `arqisabellapires/isabella-pires-arquitetura`. Os 19 commits estão
   locais na `main`. Para publicar: dar acesso de escrita à conta, ou
   apontar o remote para um fork.

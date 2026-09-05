# Entenda o projeto — do Framer ao site próprio

Documento de contexto, escrito em 05/09/2026. Explica **o que estamos
fazendo, por quê, o que já deu errado e o que ainda falta**, sem assumir
conhecimento prévio. Se você só vai ler um arquivo deste repositório, leia
este.

> **Se você é o próximo agente, comece por
> [../HANDOFF-PROXIMO.md](../HANDOFF-PROXIMO.md).** Este documento explica o
> porquê do projeto; aquele diz o que fazer agora.

Os outros dois documentos são complementares: o [HANDOFF.md](../HANDOFF.md)
tem o estado técnico corrente e as armadilhas; o
[PLANO.md](../PLANO.md) tem as fases. Este aqui é o "por quê".

---

## 1. O ponto de partida: o que era o Framer

A cliente, **Isabella Pires**, é arquiteta em Maringá (PR). O site dela era
feito no **Framer** — uma ferramenta de site visual, do tipo "arrasta e
solta", em que você monta as páginas numa tela parecida com a do Figma e a
ferramenta gera o site.

Framer é bom para publicar rápido e não exige programador. O problema é o
que ele cobra em troca:

- **Você não é dono do código.** O site vive dentro do serviço deles.
- **É assinatura.** Parar de pagar é o site sair do ar.
- **Você não controla o que ele gera.** E o que ele gerava, medimos, era
  ruim para o Google.

Somando: **a assinatura vence em 30 de setembro de 2026.** Essa data é o
relógio de todo o projeto — tudo que dependia do Framer estar de pé precisava
sair de lá antes.

### O que estava tecnicamente errado no site do Framer

Isto não é opinião, foi medido no site real:

| Problema | Medida | Por que importa |
|---|---|---|
| Três páginas empilhadas numa só | 629 KB de HTML, 786 `<div>` na home | O Framer gera um HTML para desktop, um para tablet e um para celular, e **manda os três** para todo visitante. O navegador baixa e processa três páginas para exibir uma. |
| Estilo colado no HTML | 193 KB em 9 blocos, 1.297 `style=""` | Nada é reaproveitável. Mudar uma cor é caçar string. |
| Sem estrutura de texto | **0 `<h1>` em 10 das 15 páginas** | `<h1>` é como se marca "este é o título da página". Sem isso, o Google não sabe do que a página trata. Estava tudo como parágrafo comum. |
| Títulos de aba repetidos | As 5 páginas principais tinham o **mesmo** `<title>` | Cinco páginas dizendo ser a mesma coisa. Nenhuma se destaca em busca. |
| Zero dados estruturados | Nenhum JSON-LD | Não havia nada dizendo ao Google "isto é um escritório de arquitetura, em Maringá, com este telefone". |
| 20 dos 25 artigos fora do ar | 404 | O Google derruba do índice URL que responde "não existe". |
| Sitemap inexistente | 404 | O mapa que diz ao Google quais páginas existem não existia. |

O objetivo declarado do projeto, nas suas palavras, é **"SEO e beleza"**. A
beleza já existia. O SEO estava quebrado na fundação.

---

## 2. O que estamos construindo, e em que linguagem

### Astro (é isso mesmo, não "Astra")

O site novo é feito em **Astro** — um framework de sites em JavaScript.
"Framework" aqui significa: um conjunto de ferramentas que organiza o código
e monta as páginas no final.

A característica do Astro que importa para este projeto: ele **gera páginas
HTML prontas no momento da publicação**, e não no navegador do visitante. O
visitante recebe HTML puro, já pronto. Por padrão, **zero JavaScript**.

Isso é o oposto do que ferramentas como React fazem sozinhas (enviar um
programa que monta a página no navegador). Para um site de arquitetura, que
precisa ser rápido e aparecer no Google, o modelo do Astro é o certo.

### O que significa "componente"

Você mencionou querer componentes. É exatamente o que foi feito, e vale
explicar o que muda na prática.

No Framer, o cabeçalho estava **copiado 15 vezes**, uma em cada página, com
todo o estilo colado junto. Mudar o menu significava mudar em 15 lugares — ou
melhor, significava não conseguir mudar.

Agora existe **um** arquivo, `src/components/Cabecalho.astro`, e as 39
páginas o usam. Mudar o menu é mudar uma linha, num lugar.

Os componentes que existem hoje:

```
src/components/
  Cabecalho.astro          o menu, com a versão de celular
  Rodape.astro             o rodapé, três colunas
  Seo.astro                título, descrição, imagem de compartilhamento
  JsonLd.astro             os dados estruturados para o Google
  artigos/CardArtigo.astro o card de artigo na grade
  formularios/Contato.astro
  formularios/Newsletter.astro
```

E o conteúdo ficou **separado do layout**: os 25 artigos são arquivos de
texto em `src/content/artigos/`, os 4 projetos em `src/content/projetos/`.
Trocar o texto de um artigo não encosta no código.

---

## 3. A dificuldade central: como copiar um site sem ter o código dele

Este é o problema que definiu o projeto inteiro, e a primeira tentativa
falhou nele.

O objetivo era: **o site novo tem que ficar idêntico ao antigo**, para a
cliente não perceber a troca. Melhorias vêm depois, uma a uma, com você
dirigindo.

### A primeira tentativa: reconstruir "no olho". Não funcionou.

A home foi reconstruída olhando o site e escrevendo o código. O resultado
divergiu em **14 pontos**: títulos inventados, seções esquecidas, números
errados. Está no histórico do git (`cb20c52`, `821f036`).

A causa não foi falta de capricho. Foi **falta de referência**: sem um jeito
de comparar o que se escreveu com o que existe, cada valor de espaçamento e
cor vira chute. E chute não converge — você conserta uma coisa e quebra
outra.

### A segunda tentativa: transformar o site antigo em régua

A virada foi parar de olhar e começar a **medir**.

**Passo 1 — fotografar o site antigo.** As 15 páginas foram capturadas em 3
larguras de tela (desktop 1440px, tablet 1000px, celular 390px) = **45
capturas**, guardadas no repositório.

**Passo 2 — medir cada elemento.** Um programa abre cada captura num
navegador de verdade e anota, para cada pedaço de texto e cada imagem: a
posição exata, o tamanho da caixa, a fonte, o peso, a cor, o espaçamento.
Resultado: **10.816 elementos medidos**, em arquivos versionados.

Isso é o que resolve o problema. Escrever o site novo deixou de ser "acho que
esse título tem uns 60 pixels" e passou a ser "o arquivo de medidas diz 60px,
peso 600, Mulish, cor #21201f".

**Passo 3 — travas automáticas.** Programas que conferem o resultado e
reprovam quando algo está errado. Voltarei a eles na seção 6, porque é aí que
está a parte mais útil deste documento.

### Por que o site antigo inteiro está no repositório

Você notou que o HTML do Framer está aqui. Está de propósito, e é importante
que continue:

- **`_capturas/`, 169 MB, 110 arquivos versionados** — as 45 capturas em
  HTML, mais as medidas extraídas delas. É a especificação do que o site tem
  que ser. Depois que o Framer vencer, é a única prova de como o site era.
- **`_capturas/_videos/`, 133 vídeos** — gravações das animações do site
  antigo, uma por interação por tamanho de tela. Ficam **fora do git** por
  peso, mas há backup.
- **`_fonte-framer/` e `_referencia/`** — o código interno do Framer e as
  imagens originais. Fora do git (código deles é proprietário e o repositório
  é público), mas no backup.

Tudo isso está empacotado em `~/backups/isabella-pires/`, **298,8 MB, com
soma de verificação e contagem conferida** (800 de 800 arquivos). Fica no
mesmo disco: protege contra o Framer vencer, não contra a máquina morrer.

---

## 4. Onde estamos: o que já está pronto

O site inteiro foi reconstruído. **Não existe mais nenhuma página do Framer
sendo servida.**

| | Framer | Agora |
|---|---|---|
| Páginas | 15 | **39** |
| Peso por página | 250–630 KB | **17 KB** (média) |
| JavaScript | 3 páginas + runtime deles | **4 KB no site todo** |
| `<h1>` | faltava em 10 de 15 | **1 em todas as 39** |
| Título de aba | repetido em 5 | **único em todas** |
| Dados estruturados | nenhum | **89 blocos** |
| Artigos no ar | 5 | **25** |

As 39 páginas são: a home, 5 institucionais (serviços, sobre nós, contato,
projetos, blog), 25 artigos, 4 páginas de categoria e 4 de projeto.

**Os formulários funcionam de verdade** — testados contra a Brevo (o serviço
de e-mail) com envio real: a mensagem chega. As quatro travas que existiam
foram todas resolvidas.

**Está de pé para você ver**, sem precisar de login:
https://isabella-pires-arquitetura-85flo9qx0.vercel.app

> **Correção (05/09/2026):** este documento dizia que o site oficial
> continuava com o Framer. **Não continua.**
> `www.isabellapiresarquitetura.com.br` responde 23 KB de Astro pela Vercel
> — a troca já aconteceu, e é o site novo que a cliente vê.

---

## 5. O que ainda está diferente do original — e o motion

Você disse que ficou "bem diferente do design proposto". Aqui está o
diagnóstico honesto do que falta.

> **Atualização de 05/09/2026:** esta seção descrevia o estado antes da
> rodada do Figma. As animações **foram implementadas** (15 das 17 molas), e
> a maior diferença não era o motion: era que **três das quatro fontes do
> design nunca carregaram**. Ver [PLANO-FIGMA.md](PLANO-FIGMA.md). O texto
> abaixo fica como registro do diagnóstico anterior.

### 5.1. As animações não foram implementadas — esta é a maior diferença

O site do Framer tinha **17 interações**, todas medidas e gravadas em vídeo
antes da assinatura vencer. Esta é a lista:

| Interação | O que fazia |
|---|---|
| `reveal-entrada` | Elementos deslizam e aparecem conforme você rola |
| `menu-celular` | O menu abre no celular (59px → 519px) |
| `carrossel-home` | Os projetos passam na home |
| `carrossel-projetos` | Idem, em tablet e celular |
| `card-projeto-hover` | O card reage ao mouse (557px → 367px) |
| `card-projeto-abre` | O card abre |
| `acordeao-servicos` | Os serviços expandem ao clicar |
| `galeria-casa-ip` | Galeria do projeto |
| `servicos-numerados-home` | Os números da home |
| `cta-antes-do-rodape`, `botao-enviar`, `filtros-categoria-artigos`, `newsletter-artigos`, `ver-todas-postagens` | Movimentos menores |

**No site novo, quase nada disso existe.** O que há é: o menu de celular
abre, o acordeão de serviços abre (usando `<details>`, recurso nativo do
navegador), e o card de projeto tem um leve aumento no hover. Só.

E há um detalhe que preciso apontar em vez de esconder: as bibliotecas de
animação **`motion` e `lenis` estão instaladas no projeto mas não são usadas
por nenhuma linha de código**. Foram instaladas na primeira tentativa e
ficaram lá.

Ou seja: **o site novo está mais rápido e mais correto, mas mais parado.** Se
ao ver o preview a sensação foi "está sem vida", é isso. Não é impressão.

Por que ficou assim: as animações eram a Fase 2 do plano em termos de
prioridade real, mas o que estava sangrando era SEO — 20 artigos em 404, zero
`<h1>`, títulos repetidos. Fiz o que parava o sangramento primeiro. As
gravações e as medidas de cada mola (a "física" de cada animação: quanto
quica, quanto dura) estão todas guardadas — dá para implementar fielmente.

### 5.2. Textos e imagens que dependem de você

- **As 20 imagens de projeto estão sem descrição (`alt`).** Está marcado
  `TODO(gabriel)` em cada uma. Descrição de imagem é texto, e a regra do
  projeto é que texto é seu — não invento.
- **As três páginas de política** (Termos, Privacidade, Cookies) não existem.
  No Framer os links do rodapé apontavam para o vazio. Deixei como texto sem
  link, em vez de link quebrado.

### 5.3. Nenhuma página foi aprovada por você

Isto é importante e quero deixar explícito: eu **não posso dizer que está
igual**. O que posso afirmar é que cada valor veio das medidas e que as
travas automáticas passam. Comparar lado a lado e dizer "sim, é isto" é uma
decisão sua, e não foi feita.

### 5.4. Faltam medições de velocidade

O plano pede nota ≥ 95 no Lighthouse (a ferramenta do Google que mede
velocidade). Ela não está instalada, e instalar uma dependência grande é
decisão sua. Escrevi uma auditoria que mede o que dá sem ela — estrutura,
metadados, acessibilidade. Velocidade real ainda não foi medida.

---

## 6. As armadilhas que este projeto ensinou

Esta seção é a mais útil para quem for continuar, porque cada item aqui
custou tempo de verdade.

### "Parece certo" não é verificação

Três defeitos no arquivo de cores e fontes **não davam erro em lugar
nenhum**. CSS inválido é descartado em silêncio pelo navegador: ele não
reclama, só ignora. O arquivo parecia impecável enquanto o navegador jogava
fora as 517 definições de cor e tamanho.

O que revelou: abrir o arquivo num navegador de verdade e perguntar "quantas
definições chegaram?".

### Quatro defeitos só apareceram quando o site foi publicado

Isto é o argumento mais forte a favor de publicar em preview antes de trocar
o site oficial. Os quatro passavam por toda verificação local:

1. **10 redirecionamentos em loop infinito.** URLs antigas de artigo
   apontando para si mesmas. Abria com barra no final, quebrava sem — que é
   exatamente como o Google chegaria neles.
2. **As 97 fontes não carregavam.** O arquivo apontava para nomes que nunca
   existiram no disco. **O site inteiro estava na fonte do sistema.**
3. **O título da home estava marrom sobre fundo preto** — ilegível.
4. **O menu estava branco sobre fundo bege** em todas as páginas internas —
   invisível.

Os dois primeiros só um acesso real revela. Os dois últimos, só olhar a tela.

### Medida serve para geometria, não para texto

O arquivo de medidas guarda um elemento por caixa. Um parágrafo com uma
palavra em negrito no meio vira três registros — e o texto do negrito
**some** do parágrafo.

Resultado prático: os projetos saíram com "a análise do e da relação" (sem a
palavra "terreno"), e os quatro projetos chegaram a se chamar **"I"**, porque
o rodapé tem um "ISABELLA" decorativo com cada letra numa caixa separada,
maior que o título de verdade.

A regra: **medida para posição, tamanho e cor; o HTML da captura para
texto.**

### Portão que nunca falhou é decoração

Toda trava automática deste projeto foi testada **com o defeito de propósito
dentro**, para provar que reprova. Uma delas nasceu cega: pulava elementos
com filhos, e o título da home tem uma quebra de linha dentro — então ela
passava batido justamente pelo erro que existia para pegar.

### Antes de rodar algo demorado, teste num caso que deve falhar

O gravador de vídeos rodou 133 vezes e só 5 pegaram movimento. O defeito era
do gravador. Ele tinha sido testado em um caso só — e justamente num que já
funcionava.

---

## 7. O que eu proporia a seguir

Em ordem de impacto, na minha leitura. A decisão é sua.

### Primeiro: as animações

É a maior diferença sentida entre o site antigo e o novo, e tudo que é
preciso já está guardado: as 17 fichas com a física de cada movimento e os
133 vídeos de referência.

Faria em CSS moderno, não com biblioteca pesada — dá para expressar mola de
verdade em CSS hoje, e as curvas já foram calculadas. As bibliotecas
instaladas e não usadas sairiam, ou passariam a ser usadas de fato.

### Segundo: comparar lado a lado, com você

Uma tela com o site antigo à esquerda e o novo à direita, nos três tamanhos,
para você aprovar seção por seção. A ferramenta já existe no repositório
(`tools/compara.mjs`), só não foi usada com você presente.

### Terceiro: trocar o site oficial

Só depois dos dois anteriores. E é reversível — a Vercel guarda as versões
anteriores.

### Quarto: velocidade e Google

Medir com Lighthouse, colocar o Google Analytics (falta o identificador) e
cadastrar o site no Search Console. Fora do código, e o mais valioso para
"arquitetura em Maringá": criar o **Perfil da Empresa no Google** da
Isabella.

### Depois: o CMS de blog

Um painel para a Isabella escrever os artigos sozinha, sem mexer em código.
Tem desenho próprio em
[docs/superpowers/specs/](superpowers/specs/2026-09-01-cms-blog-reutilizavel-design.md)
e a ideia é que sirva para outros sites seus também.

### Uma pergunta que vale abrir

O plano atual manda **reproduzir o original fielmente** e só depois melhorar.
Se a sua leitura ao ver o preview foi "queria algo diferente disso", talvez
valha rediscutir esse rumo — reproduzir fielmente um design que você não quer
mais é trabalho jogado fora. Não mudei nada nessa direção porque a decisão é
sua e está registrada como fechada.

---

## 8. Glossário

| Termo | O que é |
|---|---|
| **Framer** | Ferramenta visual de sites, por assinatura. De onde estamos saindo. |
| **Astro** | O framework do site novo. Gera HTML pronto, sem JavaScript por padrão. |
| **Componente** | Um pedaço reutilizável (o cabeçalho, um card). Escrito uma vez, usado em todas as páginas. |
| **Vercel** | Onde o site fica hospedado, na conta da cliente. |
| **Build** | Montar o site final a partir do código. |
| **Deploy** | Publicar o resultado. |
| **Preview** | Publicação de teste, em endereço separado, sem tocar no site oficial. |
| **Breakpoint** | As larguras de tela em que o layout muda: 1440, 1000 e 390 pixels. |
| **`<h1>`** | A marcação de "título principal da página". O Google usa para entender o assunto. |
| **JSON-LD** | Bloco invisível que diz ao Google "isto é um escritório de arquitetura, em Maringá, com este telefone". |
| **`alt`** | Descrição de uma imagem. Para quem usa leitor de tela, e para o Google. |
| **301 / 302** | Redirecionamento. 301 é permanente e passa a reputação da URL antiga; 302 é temporário e não passa. |
| **Sitemap** | Lista das páginas do site, entregue ao Google. |
| **Lighthouse** | Ferramenta do Google que dá nota de velocidade e acessibilidade. |
| **Brevo** | Serviço que envia os e-mails do formulário. |
| **Mola (spring)** | Como uma animação se move: quanto quica, quanto demora. O Framer usava; os valores foram extraídos. |

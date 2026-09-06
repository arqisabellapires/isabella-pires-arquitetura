# Handoff — auditoria de animação e design contra os vídeos

Escrito em 06/09/2026. Este documento existe porque a auditoria de animação é
cara em contexto (vídeo vira imagem, e são 133 arquivos) e merece uma sessão
limpa só para ela.

**Cole este arquivo numa sessão nova e comece por aqui.**

---

## 1. A regra que rege este projeto

Fixada pelo Gabriel, e já aplicada no resto do site:

- **O Figma manda na FORMA** — que desenho a seção tem.
- **O Framer manda no TAMANHO** — altura de menu, corpo de fonte, imagem.
- **Os vídeos mandam no MOVIMENTO** — é o que falta fazer.

Ferramenta pronta para o lado do tamanho:

```bash
node tools/tamanhos-framer.mjs [rota]   # escala de texto, menu e imagens
```

---

## 2. O que o Gabriel descreveu, e ainda não foi conferido

Ele apontou três comportamentos de memória. **Nenhum foi verificado contra os
vídeos** — comece por eles:

### 2.1. Zoom interno nas imagens ao rolar (seção de Serviços)

> "Eu ia descendo, scrollando o mouse pra baixo, e as imagens iam dando um
> zoom interno bem legal, cada uma."

Vídeo: `_capturas/_videos/servicos.desktop.acordeao-servicos.webm` e
`servicos.*.reveal-entrada.webm`.

Hoje o acordeão da home tem transição de `flex-grow`, e as fotos de
`/servicos` não têm zoom nenhum ao rolar. Se o vídeo confirmar, é
provavelmente um `scale()` ancorado no progresso da rolagem
(`animation-timeline: view()`, que o projeto já usa).

### 2.2. Texto fixo à esquerda em "Sobre nós"

> "Tem uma seção que tem o *sticky* na esquerda. O texto fica fixo na esquerda
> e vai descendo e na direita tem algumas coisas. Era mais ou menos assim, e a
> gente fez um pouco diferente."

Vídeo: `_capturas/_videos/sobre-nos.desktop.reveal-entrada.webm`.

Candidata mais provável: a seção do **método em quatro passos** (01–04) ou a
de **Nossos valores**. Hoje nenhuma das duas tem `position: sticky`.

### 2.3. Carrosséis e hover

> "Poder ver como é que funciona os carrosséis, quando você passa um mouse em
> algum lugar."

Vídeos: `carrossel-home`, `card-projeto-hover`, `galeria-casa-ip`,
`ver-todas-postagens`, `filtros-categoria-artigos`, `nav-desktop-estado`.

---

## 3. Onde estão os vídeos

```
_capturas/_videos/   133 arquivos .webm, 123 MB
                     padrão: <rota>.<breakpoint>.<ficha>.webm
```

As 13 fichas, cada uma em desktop/tablet/mobile:

```
acordeao-servicos      botao-enviar           card-projeto-hover
carrossel-home         cta-antes-do-rodape    filtros-categoria-artigos
galeria-casa-ip        nav-desktop-estado     newsletter-artigos
reveal-entrada         rodape-por-pagina      servicos-numerados-home
ver-todas-postagens
```

As **17 molas já medidas** estão em `_capturas/motion-fichas.json` e viraram
`linear()` nativo em `src/styles/motion.css` (gerado por
`tools/mola-para-css.mjs`). Ou seja: a *curva* de várias animações já está
certa. O que falta é conferir **o que** é animado, e em quais seções.

**Sugestão de método, para não estourar contexto:** extraia 3–4 quadros-chave
de cada vídeo com `ffmpeg` e monte uma tira, em vez de olhar o vídeo inteiro.
Um vídeo de 6s a 30fps são 180 imagens; 4 quadros bastam para ler um zoom ou
um sticky.

---

## 4. O que já está conferido — não refaça

Todas as sete telas foram auditadas contra o Figma (forma) e o Framer
(tamanho) em 05–06/09/2026. Ver `HANDOFF-PROXIMO.md` §10 para a tabela do que
estava errado em cada uma.

Em 06/09 entraram, contra o **site de referência**:

| | Era | Virou |
|---|---|---|
| rodapé | `#3a2e26` escuro, 584px | pêssego `#f0d9c7`, 484px, texto escuro |
| títulos de coluna | Faberge 400 | Mulish 700 |
| menu | 22px | 15px (token `--fig-f-menu` próprio) |
| herói | 913px, caixa em y=169 | 900px, caixa em y=110 |

O contraste do rodapé claro foi medido: `#483b2a` sobre `#f0d9c7` dá 7,99:1.

---

## 5. Estado do resto

- **No ar:** `www.isabellapiresarquitetura.com.br`, deploy automático da
  Vercel a cada push na `main`.
- **Push funciona** com o `GH_TOKEN` do `.env` (conta `arqisabellapires`).
  Ver `HANDOFF-PROXIMO.md` §8 — **empurrar publica no site oficial**.
- **Os 20 `alt`** de projeto foram escritos olhando cada imagem.
- **As três páginas de política** existem, com banner de consentimento que
  de fato controla GA4/Clarity. Nenhuma passou por advogado (cada uma avisa
  isso no rodapé da própria página).
- **CNPJ:** não existe no código. O Gabriel vai perguntar à cliente se ela
  tem — pode ser que ela seja informal. Até lá, não invente número.

Pendências antigas: Lighthouse, Search Console e o CMS de blog (**módulo à
parte**, não misture com layout).

---

## 6. Os portões

```bash
npx astro build                      # 42 páginas
node tools/valida-fontes.mjs
node tools/audita-paginas.mjs
node tools/verifica-revela.mjs
node tools/verifica-responsivo.mjs
node tools/tira-foto.mjs [--bp tablet|mobile] [/rota]
node tools/tamanhos-framer.mjs [rota]
```

Todos passam hoje. **E nenhum deles mede animação** — é a mesma armadilha do
§7 do outro handoff: passar nos portões não é evidência de que o movimento
está certo. Só o vídeo lado a lado responde isso.

Duas armadilhas do `tira-foto` que já foram consertadas e vale conhecer, para
não reintroduzir:

- ele fotografava antes de o carrossel se posicionar (hoje o posicionamento
  inicial é resolvido em CSS, e a ferramenta espera o slide ativo centrar);
- ele fotografava com imagens preguiçosas ainda cinzas, o que me fez ler
  "imagem faltando" em duas páginas onde não faltava nada.

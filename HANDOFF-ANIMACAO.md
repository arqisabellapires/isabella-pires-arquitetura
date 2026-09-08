# Handoff — auditoria de movimento, reconferência geral e CMS do blog

Atualizado em 07/09/2026. Este documento existe porque o trabalho abaixo é
caro em contexto (vídeo vira imagem, e são 133 arquivos) e merece uma sessão
limpa só para ele.

**Cole este arquivo numa sessão nova e comece por aqui.**

São **três frentes**, nesta ordem de prioridade:

1. **Reconferir cada seção e cada efeito** contra o site de referência do
   Framer e os vídeos (§2, §3, §4);
2. **Refazer a cara do blog** seguindo o **Framer, não o Figma** (§5);
3. **Construir o CMS** para a Isabella publicar no blog sozinha (§6).

---

## 1. As regras que regem este projeto

Fixadas pelo Gabriel, e já aplicadas no resto do site:

- **O Figma manda na FORMA** — que desenho a seção tem.
- **O Framer manda no TAMANHO** — altura de menu, corpo de fonte, imagem.
- **Os vídeos mandam no MOVIMENTO** — é o que falta fazer.
- **No BLOG, o Framer manda em tudo**, inclusive na forma. Ver §5.

### As três fontes de verdade

| Fonte | Onde | Serve para |
|---|---|---|
| **Site de referência (Framer)** | https://authentic-learning-761482.framer.app/ | tamanho, e a forma do blog |
| **Capturas do Framer** | `_capturas/<rota>/medidas.*.json` | o mesmo, offline e medível |
| **HTML do Framer** | `_capturas/<rota>/desktop.html` (e tablet/mobile) | ler a ESTRUTURA de cada tela |
| **JS do Framer** | `_fonte-framer/` | 116 arquivos `.js` — **não tem HTML**, é o bundle |
| **Figma** | fileKey `w03gcodehy5qey828y58hS` | forma das outras seis telas |
| **Vídeos** | `_capturas/_videos/` | movimento |

**Dois avisos sobre essas fontes:**

1. A URL do Framer responde 200, mas o Playwright dá **timeout** com
   `waitUntil: 'networkidle'` — o Framer mantém conexões abertas. Use
   `domcontentloaded` + `waitForTimeout`, ou prefira as capturas locais.
2. `_fonte-framer/` **não contém HTML** — são 116 arquivos `.js` do bundle do
   Framer, úteis só para caçar a implementação de uma animação específica. Para
   ler a estrutura de uma tela, use `_capturas/<rota>/desktop.html`.

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

## 5. O blog segue o FRAMER, não o Figma

**Decisão do Gabriel, em 07/09/2026:** a cara do blog tem de ser a do site de
referência do Framer. Onde o Figma discordar, o Framer vence — na forma
também, não só no tamanho. Esta é a única parte do site onde a regra da §1 se
inverte.

Vale para as duas telas:

- **listagem** — `/artigos` (referência: `_capturas/artigos/`)
- **artigo** — `/artigos/<slug>` (referência:
  `_capturas/artigos__vale-mais-a-pena-reformar-ou-construir/`)

### O que já se sabe que difere

Medido com `node tools/tamanhos-framer.mjs artigos`, ainda **não corrigido**:

| | Framer | Nosso hoje |
|---|---|---|
| título da página | **64px Manrope 500** | 60px Mulish, e o texto é só "Blog" |
| subtítulo | "Dicas e notícias para quem realmente se destaca." | **não existe** |
| card: título | 20px Mulish 700 | 20px Mulish 700 ✓ (corrigido em 05/09) |
| card: imagem | 368×270 r8 | 368×270 r8 ✓ (corrigido em 05/09) |

Sobre a fonte: **Manrope já está em `src/styles/fontes.css`** (2 arquivos,
servidos do próprio domínio) — só não é usada em lugar nenhum ainda, e **não
consta na lista do `tools/valida-fontes.mjs`**. Se o blog passar a usá-la,
acrescente-a ao portão, senão ninguém percebe se ela quebrar.

Continue servindo do próprio domínio: hoje o site não faz **nenhuma**
requisição externa (conferido com Playwright: zero hosts), e a Política de
Cookies afirma isso ao visitante. Puxar fonte do Google Fonts quebraria essa
promessa.

⚠️ **O corpo do artigo tem regra própria.** `src/styles/artigo.css` já foi
medido contra a captura do Framer e traz um aviso no topo dizendo para não
editar por gosto. Confira antes de mexer: pode ser que já esteja certo.

### Como conferir

```bash
node tools/tamanhos-framer.mjs artigos          # escala do Framer
node tools/tira-foto.mjs /artigos               # o nosso
```
E o HTML do Framer, para ler a estrutura: `_capturas/artigos/desktop.html`.

---

## 6. O CMS do blog

**Objetivo:** a Isabella publicar um artigo sozinha, sem mexer em código nem
pedir deploy.

### O que já está preparado

`src/content.config.ts` foi escrito com essa troca em mente. O comentário no
topo diz:

> O `loader` é o ponto de troca entre a V1 e a V2. Hoje: lê markdown de
> `src/content/`. Na Fase 5 (CMS): este `glob()` vira um loader que consulta o
> Supabase. Os schemas e as páginas que consomem `getCollection()` não mudam.

Ou seja: **trocar a fonte dos dados não deve exigir tocar nas páginas.** Se
você se pegar reescrevendo `/artigos` para o CMS funcionar, parou algo errado.

O schema de `artigos` já tem tudo que um editor precisa: `titulo`, `resumo`,
`capa` + `capaAlt`, `publicadoEm`, `atualizadoEm`, `autor`, `categoria`,
`tags`, `publicado`, `destaque`, `seoTitulo`, `seoDescricao` e `slugAntigo`.

O `.env` já traz `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_DATABASE_PASSWORD`, e as **quatro
estão preenchidas** (conferido em 07/09). Ou seja, já existe um projeto
Supabase de pé em algum lugar — descubra o que tem dentro antes de criar
tabela nova.

O pacote `@supabase/supabase-js` **não está instalado**.

### Decisões que são do Gabriel, não suas

Pergunte antes de escolher:

1. **Supabase mesmo, ou um CMS pronto?** O `.env` sugere Supabase, mas
   Decap/Sveltia (que commitam markdown no próprio repo, sem banco) resolvem o
   caso de uma autora que publica um artigo por mês — e sem custo de banco.
2. **Como o site atualiza ao publicar?** Rebuild por webhook, ou renderização
   sob demanda? Hoje o site é SSR na Vercel, então as duas cabem.
3. **Quem entra?** Só a Isabella, ou mais gente? Isso define se precisa de
   papéis ou se basta um login.

### Limites

- **Não misture com layout.** O CMS é módulo à parte; se estiver mexendo em
  CSS de artigo por causa do CMS, separou errado.
- **Imagem tem `alt` obrigatório** no schema, e o portão `audita-paginas`
  reprova imagem sem `alt`. O editor precisa pedir a descrição — não deixe
  cair um `alt` vazio no banco.
- **Texto é da cliente.** O CMS não inventa copy nem gera artigo.

---

## 7. Estado do resto

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

Pendências antigas: **Lighthouse** e **Search Console** — nenhum dos dois foi
tocado.

---

## 8. Os portões

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

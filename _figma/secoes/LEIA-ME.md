# Capturas de seção do Figma

As imagens que **provam** as divergências apontadas na §2 do
`HANDOFF-PROXIMO.md`. Guardadas aqui porque as URLs que o MCP do Figma
devolve expiram em 7 dias.

| Arquivo | Node | O que mostra |
|---|---|---|
| `home-1177-heroi.png` | `1:177` | herói — **este está fiel no site** |
| `home-1223-historias-recentes.png` | `1:223` | carrossel de projetos — o site tem 3 cards empilhados |
| `home-1300-servicos.png` | `1:300` | acordeão horizontal de imagens — o site tem grade de texto |
| `home-1351-blog.png` | `1:351` | texto à esquerda + carrossel à direita — o site tem bloco centrado |
| `home-1332-formulario.png` | `1:332` | form à esquerda, texto à direita — o site empilha |

Para gerar mais: `mcp__figma__get_screenshot` com fileKey
`w03gcodehy5qey828y58hS` e o nodeId, depois `curl -sL -o <arquivo> <url>`.

**Olhe a imagem antes de escrever o código da seção.** Foi exatamente esse
passo que faltou e que produziu o retrabalho.

# `_figma/` — o design, guardado fora do Figma

Extraído em 05/09/2026 do arquivo Figma `w03gcodehy5qey828y58hS`
("Isabella Pires"), pelo MCP.

**Por que existe:** as URLs de asset que o Figma devolve **expiram em 7
dias**, e o MCP pode não estar disponível na próxima sessão. O design é a
fonte de verdade do layout deste projeto (ver `docs/PLANO-FIGMA.md`), então
ele fica versionado aqui, offline.

## O que tem

| Arquivo | Node | Página |
|---|---|---|
| `home-design-context.json` | `1:176` | Home |
| `projetos-lista-design-context.json` | `1:762` | Projetos (listagem) |
| `projeto-detalhe-design-context.json` | `1:954` | Projeto detalhe (Casa IP) |
| `blog-design-context.json` | `1:1093` | Blog (listagem) |
| `sobre-design-context.json` | `1:1363` | Sobre nós |
| `contato-design-context.json` | `1:1643` | Contato |
| `metadata-pagina.json` | `0:1` | árvore de frames das 7 telas |

Serviços (`1:548`) não tem o bruto salvo — as medidas dele foram extraídas
direto para `servicos-medidas.json`, que é o que interessa.

Os `*-medidas.json` são a leitura útil: valores em português, seção por
seção, com uma lista de **divergências medidas contra o site no ar**.

## Como ler sem estourar o contexto

Os `-design-context.json` têm 33–69 mil caracteres. **Nunca faça `cat`.**

```bash
python3 -c "import json; t=json.load(open('_figma/home-design-context.json'))[0]['text']; print(t[:15000])"
```

O formato é `[{type, text}]`; `[0].text` é React+Tailwind gerado pela Figma.

## Duas ressalvas que valem para todos os arquivos

1. **`Segoe UI` não é decisão de design.** É o fallback do computador do
   designer. Onde aparecer, sanear — não reproduzir.
2. **Tamanhos quebrados (31px, 71px) são texto redimensionado à mão.**
   Arredondar para a escala, não copiar.

E o principal: **o Figma só tem 1920px**. Não há nada de responsivo aqui. Para
tablet e celular, a referência continua sendo `_capturas/`.

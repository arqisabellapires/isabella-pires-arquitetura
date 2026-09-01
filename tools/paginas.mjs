/**
 * Tabela única das páginas do site. Todos os scripts do pipeline leem daqui,
 * para que capturar, fundir, processar e verificar falem dos mesmos itens.
 *
 *   caminho — rota no Framer, com acento, como o site vivo serve
 *   pasta   — diretório em _capturas/
 *   rota    — rota final no site novo, ASCII
 */
export const PAGINAS = [
  { caminho: '/',        pasta: 'home',        rota: '/' },
  { caminho: '/sobre-nós', pasta: 'sobre-nos', rota: '/sobre-nos/' },
  { caminho: '/serviços',  pasta: 'servicos',  rota: '/servicos/' },
  { caminho: '/contato',   pasta: 'contato',   rota: '/contato/' },
  { caminho: '/projetos',  pasta: 'projetos',  rota: '/projetos/' },
  { caminho: '/projetos/casa-ip', pasta: 'projetos__casa-ip', rota: '/projetos/casa-ip/' },
  { caminho: '/projetos/ap-mm',   pasta: 'projetos__ap-mm',   rota: '/projetos/ap-mm/' },
  { caminho: '/projetos/studio',  pasta: 'projetos__studio',  rota: '/projetos/studio/' },
  { caminho: '/artigos/blog', pasta: 'artigos', rota: '/artigos/' },
  {
    caminho: '/artigos/vale-mais-a-pena-reformar-ou-construir',
    pasta: 'artigos__vale-mais-a-pena-reformar-ou-construir',
    rota: '/artigos/vale-mais-a-pena-reformar-ou-construir/',
  },
  {
    caminho: '/artigos/organize-sua-casa-com-olhar-de-arquiteto',
    pasta: 'artigos__organize-sua-casa-com-olhar-de-arquiteto',
    rota: '/artigos/organize-sua-casa-com-olhar-de-arquiteto/',
  },
  {
    caminho: '/artigos/o-que-muda-na-arquitetura-residencial-em-2026',
    pasta: 'artigos__o-que-muda-na-arquitetura-residencial-em-2026',
    rota: '/artigos/o-que-muda-na-arquitetura-residencial-em-2026/',
  },
  {
    caminho: '/artigos/iluminação-decorativa-x-iluminação-funcional',
    pasta: 'artigos__iluminacao-decorativa-x-iluminacao-funcional',
    rota: '/artigos/iluminacao-decorativa-x-iluminacao-funcional/',
  },
  {
    caminho: '/artigos/minimalismo-vs.-maximalismo-qual-estilo-combina-com-você',
    pasta: 'artigos__minimalismo-vs-maximalismo-qual-estilo-combina-com-voce',
    rota: '/artigos/minimalismo-vs-maximalismo-qual-estilo-combina-com-voce/',
  },
];

/** Os três breakpoints do Framer, extraídos do CSS dele. */
export const BREAKPOINTS = [
  { nome: 'desktop', largura: 1440, altura: 900,  movel: false, media: '(min-width: 1200px)' },
  { nome: 'tablet',  largura: 1000, altura: 1000, movel: false, media: '(min-width: 810px) and (max-width: 1199.98px)' },
  { nome: 'mobile',  largura: 390,  altura: 844,  movel: true,  media: '(max-width: 809.98px)' },
];

/** Qual breakpoint uma largura de viewport ativa. */
export const breakpointDe = (largura) =>
  largura >= 1200 ? BREAKPOINTS[0] : largura >= 810 ? BREAKPOINTS[1] : BREAKPOINTS[2];

/** Link relativo do Framer → rota nova. Vira 301 no lançamento. */
export const LINKS = Object.fromEntries(
  PAGINAS.map((p) => [p.caminho === '/' ? './' : `.${p.caminho}`, p.rota]),
);

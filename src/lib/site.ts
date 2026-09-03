/**
 * Dados canônicos do site. Fonte única para SEO, JSON-LD, cabeçalho e rodapé.
 *
 * TODO ESTE ARQUIVO É EXTRAÍDO DAS MEDIDAS, não escrito de memória. Telefone,
 * e-mail e endereço saem de `_capturas/contato/medidas.desktop.json`; as URLs
 * saem dos `href` de `_capturas/home/desktop.html`; a ordem do menu sai da
 * posição x dos links no cabeçalho medido.
 *
 * A versão anterior era da primeira tentativa de reconstrução e estava errada
 * em dois pontos que teriam vazado para o site novo: apontava `/sobre`, que
 * nunca existiu e dá 404 (HANDOFF §4.7), e deixava telefone, e-mail e endereço
 * vazios — que é justamente o que o LocalBusiness da Fase 3 precisa ter.
 */
export const site = {
  nome: 'Isabella Pires Arquitetura',
  nomeCurto: 'Isabella Pires',
  url: 'https://www.isabellapiresarquitetura.com.br',
  descricao:
    'Projetos de arquitetura e interiores que traduzem quem você é. ' +
    'Residencial, comercial e reformas, do conceito à obra.',
  idioma: 'pt-BR',
  locale: 'pt_BR',
  autora: 'Isabella Pires',
  imagemPadrao: '/og-padrao.jpg',

  // Medidos em /contato/. O telefone em formato E.164 é o do link wa.me.
  telefone: '(44) 99879-0444',
  telefoneE164: '+5544998790444',
  whatsapp: 'https://wa.me/5544998790444',
  email: 'arqisabellapires@gmail.com',
  endereco: {
    logradouro: 'Rua Miguel Belai Filho, 175',
    complemento: 'interfone 21',
    bairro: 'Jardim Everest',
    cidade: 'Maringá',
    estado: 'PR',
    cep: '87075-810',
    pais: 'BR',
  },
  redes: {
    instagram: 'https://www.instagram.com/arq.isabellapires/',
    facebook: 'https://www.facebook.com/arq.isabellapires',
    linkedin: 'https://www.linkedin.com/in/arqisabellapires/',
    arroba: '@arq.isabellapires',
  },
  copyright: '© 2025 Arquiteta Isabella Pires',
} as const;

/**
 * Menu do cabeçalho, na ordem medida (posição x dos links em y=25 no desktop):
 * Home 900, Serviços 962, Projetos 1045, Blog 1124, Sobre nós 1176, Contato 1268.
 *
 * Os destinos são os `href` do Framer passados para ASCII, que é a decisão de
 * URLs já fechada no HANDOFF §5. `./serviços` → `/servicos`, `./sobre-nós` →
 * `/sobre-nos`, `./artigos/blog` → `/artigos`.
 */
export const navegacao = [
  { rotulo: 'Home', href: '/' },
  { rotulo: 'Serviços', href: '/servicos' },
  { rotulo: 'Projetos', href: '/projetos' },
  { rotulo: 'Blog', href: '/artigos' },
  { rotulo: 'Sobre nós', href: '/sobre-nos' },
  { rotulo: 'Contato', href: '/contato' },
] as const;

/** Colunas do rodapé, medidas em `_capturas/home/medidas.desktop.json`. */
export const rodape = {
  institucional: [
    { rotulo: 'Início', href: '/' },
    { rotulo: 'Serviços', href: '/servicos' },
    { rotulo: 'Projetos', href: '/projetos' },
    { rotulo: 'Sobre nós', href: '/sobre-nos' },
    { rotulo: 'Blog', href: '/artigos' },
    { rotulo: 'Contato', href: '/contato' },
  ],
  // As três páginas de política não existem no Framer: os links estavam no
  // rodapé apontando para lugar nenhum. Ficam listadas para o Gabriel decidir
  // se cria as páginas ou tira os links — não se inventa política jurídica.
  informacoes: [
    { rotulo: 'Termos de uso', href: null },
    { rotulo: 'Políticas de Privacidade', href: null },
    { rotulo: 'Políticas de Cookies', href: null },
  ],
} as const;

/** As 4 categorias reais dos 25 artigos importados do CMS do Framer. */
export const categorias = [
  'Arquitetura na Prática',
  'Dicas',
  'Notícias',
  'Projetos & Portfólios',
] as const;

/**
 * Redirecionamentos 301 das URLs antigas (Framer, com acento) para as novas.
 * Consumido por vercel.json. Preserva o SEO acumulado.
 */
export const redirecionamentos: Record<string, string> = {
  '/sobre-nós': '/sobre-nos',
  '/serviços': '/servicos',
  '/artigos/blog': '/artigos',
};

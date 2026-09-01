/** Dados canônicos do site. Fonte única para SEO, JSON-LD e rodapé. */
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
  telefone: '',
  email: '',
  endereco: { cidade: '', estado: '', pais: 'BR' },
  redes: { instagram: '', linkedin: '' },
} as const;

export const navegacao = [
  { rotulo: 'Home', href: '/' },
  { rotulo: 'Serviços', href: '/servicos' },
  { rotulo: 'Projetos', href: '/projetos' },
  { rotulo: 'Blog', href: '/artigos' },
  { rotulo: 'Sobre nós', href: '/sobre' },
  { rotulo: 'Contato', href: '/contato' },
] as const;

/**
 * Redirecionamentos 301 das URLs antigas (Framer, com acento) para as novas.
 * Consumido por vercel.json na build. Preserva o pouco de SEO acumulado.
 */
export const redirecionamentos: Record<string, string> = {
  '/sobre-nós': '/sobre',
  '/serviços': '/servicos',
  '/artigos/blog': '/artigos',
};

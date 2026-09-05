/**
 * Conteúdo transcrito do site atual, sem reescrita.
 * Melhorias de texto passam pelo Gabriel antes de entrar aqui.
 */

export const servicos = [
  {
    slug: 'arquitetura-residencial',
    sobretitulo: 'Arquitetura',
    titulo: 'Residencial',
    tituloCompleto: 'Arquitetura Residencial',
    resumoHome:
      'Residências únicas que refletem o estilo de vida dos moradores, com cada detalhe pensado para unir conforto, estética e funcionalidade.',
    paragrafos: [
      'Transformamos seu lar em um espaço que une estética, conforto e funcionalidade.',
      'Nosso processo começa com briefing e levantamento, para entender necessidades e desejos.',
      'A partir disso, definimos conceito, paleta de cores, mobiliário e disposição ideal, com detalhamentos técnicos, imagens 3D, lista de compras e acompanhamento completo.',
    ],
  },
  {
    slug: 'arquitetura-comercial',
    sobretitulo: 'Arquitetura',
    titulo: 'Comercial',
    tituloCompleto: 'Arquitetura Comercial',
    resumoHome:
      'Mais do que estética, criamos projetos que fortalecem marcas e experiências.',
    paragrafos: [
      'Mais do que estética, criamos projetos que fortalecem marcas e experiências.',
      'Cada ambiente é pensado para ser funcional, acolhedor e valorizar produtos ou serviços.',
      'Estudamos o público, fluxo e identidade da empresa, desenvolvemos conceito exclusivo e entregamos um projeto completo com 3D, lista de compras, detalhamentos técnicos e acompanhamento até a finalização.',
    ],
  },
  {
    slug: 'design-de-interiores',
    sobretitulo: '',
    titulo: 'Design de Interiores',
    tituloCompleto: 'Design de Interiores',
    resumoHome:
      'Reestruturamos ambientes para que se tornem acolhedores, funcionais e cheios de personalidade.',
    paragrafos: [
      'Reestruturamos ambientes para que se tornem acolhedores, funcionais e cheios de personalidade.',
      'Planejamos cada detalhe unindo estética, conforto e bem-estar.',
      'Com conceito exclusivo, paleta de cores, mobiliário e imagens 3D, entregamos um projeto completo, com acompanhamento e ambientação final.',
    ],
  },
  {
    slug: 'consultoria-de-decoracao',
    sobretitulo: '',
    titulo: 'Consultoria de Decoração',
    tituloCompleto: 'Consultoria de Decoração',
    resumoHome:
      'Oferecemos uma análise técnica e criativa para decisões seguras e personalizadas.',
    paragrafos: [
      'Oferecemos uma análise técnica e criativa para decisões seguras e personalizadas.',
      'Nosso atendimento é direto, prático e pensado para apoiar escolhas com eficiência.',
      'Com um serviço VIP de curadoria, acompanhamos compras e finalizamos o espaço com móveis, objetos e detalhes que refletem seu estilo.',
    ],
  },
  {
    slug: 'ambientacao',
    sobretitulo: '',
    titulo: 'Ambientação',
    tituloCompleto: 'Ambientação',
    resumoHome:
      'Cuidamos dos detalhes finais que fazem toda a diferença no espaço.',
    paragrafos: [
      'Cuidamos dos detalhes finais que fazem toda a diferença no espaço.',
      'Organizamos móveis, objetos e decoração de forma harmônica e funcional.',
      'O resultado é um ambiente pronto para ser vivido, acolhedor e cheio de personalidade.',
    ],
  },
] as const;

/** Opções do select do formulário, na ordem do site atual. */
export const opcoesServico = [
  'Arquitetura Residencial',
  'Arquitetura Comercial',
  'Design de Interiores',
  'Consultoria de Decoração',
  'Ambientação',
] as const;

export const numerosHome = [
  { valor: '2024', rotulo: 'Início de um sonho independente' },
  { valor: '+32', rotulo: 'Meses dedicados à arquitetura' },
  { valor: '+10', rotulo: 'Projetos Residenciais e comerciais' },
  { valor: '100%', rotulo: 'Foco em personalização' },
] as const;

export const rodapeLinks = {
  institucional: [
    { rotulo: 'Início', href: '/' },
    { rotulo: 'Serviços', href: '/servicos' },
    { rotulo: 'Projetos', href: '/projetos' },
    { rotulo: 'Sobre nós', href: '/sobre' },
    { rotulo: 'Blog', href: '/artigos' },
    { rotulo: 'Contato', href: '/contato' },
  ],
  informacoes: [
    { rotulo: 'Termos de uso', href: '/termos-de-uso' },
    { rotulo: 'Políticas de Privacidade', href: '/politica-de-privacidade' },
    { rotulo: 'Políticas de Cookies', href: '/politica-de-cookies' },
  ],
} as const;

/**
 * Conteúdo da página Sobre nós, transcrito do Figma (node 1:1363).
 * O design é a fonte destes textos; nada aqui foi reescrito.
 */
export const selosSobre = [
  { titulo: 'Transparência e Clareza', texto: 'Planejamento e custos sem surpresas.' },
  { titulo: 'Presença Nacional', texto: 'Projetos em qualquer região do Brasil.' },
  { titulo: 'Atendimento Humano', texto: 'Soluções sob medida para cada cliente.' },
] as const;

export const valores = [
  {
    titulo: 'Modernidade',
    texto:
      'Priorizamos soluções inovadoras e atuais, integrando tecnologia e tendências para criar projetos funcionais e cheios de estilo.',
  },
  {
    titulo: 'Empatia',
    texto:
      'Entendemos profundamente cada cliente, suas necessidades e preferências, para criar ambientes que refletem essência e proporcionam conforto.',
  },
  {
    titulo: 'Constância',
    texto:
      'Agimos com disciplina e comprometimento, acompanhando cada detalhe do projeto para garantir qualidade e resultados consistentes.',
  },
] as const;

export const passosMetodo = [
  {
    titulo: 'Briefing e Levantamento',
    texto:
      'Conversamos com você para entender estilo de vida, necessidades e expectativas, e realizamos medições e registro completo do espaço.',
  },
  {
    titulo: 'Desenvolvimento do Conceito',
    texto:
      'Criamos o conceito do projeto, definindo paleta de cores, materiais, mobiliário e disposição dos ambientes.',
  },
  {
    titulo: 'Detalhamentos Técnicos e Planejamento',
    texto:
      'Elaboramos plantas, projetos de marcenaria, iluminação e revestimentos, além de lista de compras e fornecedores para garantir precisão.',
  },
  {
    titulo: 'Execução e Ambientação',
    texto:
      'Acompanhamos a implementação, garantindo que cada detalhe seja fiel ao projeto e que o resultado final seja funcional e harmonioso.',
  },
] as const;

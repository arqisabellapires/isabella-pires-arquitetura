#!/usr/bin/env node
/**
 * As 4 capturas de projeto viram a coleção `projetos`.
 *
 *   node tools/extrai-projetos.mjs
 *
 * Por que existe: **não há coleção de projetos no CMS do Framer** — o HANDOFF
 * §4.1 mediu isso seguindo o grafo inteiro de módulos e achou uma única
 * coleção, "Blog". Os 4 projetos são componentes com variante, então não há o
 * que exportar de editor nenhum. A única fonte é a captura.
 *
 * O que sai daqui:
 *   src/content/projetos/<slug>.md          frontmatter + corpo
 *   src/assets/projetos/<slug>/<n>.<ext>    as imagens, copiadas do disco
 *
 * As imagens vêm de _referencia/, não da CDN: framerusercontent.com morre em
 * 30/09/2026 junto com a assinatura. Depois deste script, nenhuma página de
 * projeto depende mais deles.
 *
 * O que este script NÃO faz, de propósito: escrever `alt`. O texto é do
 * Gabriel (spec §7.2). Cada imagem sai com alt vazio e a lista do que falta
 * é impressa no fim.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PROJETOS = [
  { slug: 'casa-ip', pasta: 'projetos__casa-ip', categoria: 'Residencial', ordem: 1 },
  { slug: 'ap-mm', pasta: 'projetos__ap-mm', categoria: 'Residencial', ordem: 2 },
  { slug: 'studio', pasta: 'projetos__studio', categoria: 'Comercial', ordem: 3 },
  { slug: 'cozinha-la', pasta: 'projetos__cozinha-la', categoria: 'Interiores', ordem: 4 },
];

const DIR_IMAGENS = '_referencia/framerusercontent.com/images';
const disponiveis = existsSync(DIR_IMAGENS) ? readdirSync(DIR_IMAGENS) : [];
if (!disponiveis.length) {
  console.error(`sem imagens em ${DIR_IMAGENS} — o backup do Framer é necessário`);
  process.exit(1);
}

/** O clone salva variantes como `base@query`, não `base?query` (armadilha §6.4). */
const achaArquivo = (src) => {
  const id = src.split('/').pop().split('?')[0].replace(/\.[a-z]+$/i, '');
  return disponiveis.find((f) => f.startsWith(id + '.')) ?? null;
};

const semAlt = [];

for (const { slug, pasta, categoria, ordem } of PROJETOS) {
  const arquivo = join('_capturas', pasta, 'medidas.desktop.json');
  const dados = JSON.parse(readFileSync(arquivo, 'utf8'));
  const textos = dados.elementos.filter((e) => e.texto && e.texto.trim() && e.fonte);

  /*
    Título: o hero do projeto.

    "O maior texto da página" NÃO serve, e a primeira versão deste script caiu
    nisso: os quatro projetos saíram chamados "I". O rodapé tem um "ISABELLA"
    decorativo a 110px com CADA LETRA num <span> próprio — maior que o hero de
    100px, e o sort devolvia a letra I.

    Então: só tag de bloco (nunca <span>, que é onde mora letra solta), e pelo
    menos 2 caracteres. É o hero de verdade, e não a decoração.
  */
  const BLOCO = new Set(['p', 'h1', 'h2', 'h3', 'div']);
  const hero = textos
    .filter((e) => e.fonte.tamanho >= 60 && BLOCO.has(e.tag) && e.texto.trim().length >= 2)
    .sort((a, b) => b.fonte.tamanho - a.fonte.tamanho)[0];
  const titulo = hero ? hero.texto.trim() : slug;

  // Ficha técnica: os rótulos e o valor que vem logo depois de cada um.
  const ficha = {};
  for (let i = 0; i < textos.length - 1; i++) {
    const rotulo = textos[i].texto.trim();
    if (['Ano', 'Autoria', 'Localização'].includes(rotulo)) ficha[rotulo] = textos[i + 1].texto.trim();
  }

  /*
    Corpo: os parágrafos da seção "Concepção e Processo".

    Aqui a MEDIDA NÃO SERVE, e vale registrar por quê: `medidas.json` guarda um
    elemento por caixa, então um <p> com <strong> dentro vira três entradas — o
    parágrafo (já sem o texto do negrito) e os dois <strong> soltos. Extrair do
    campo `texto` produzia "a análise do e da relação", com a palavra "terreno"
    faltando no meio.

    Quem preserva a ordem do texto é o HTML da captura. Então o corpo sai de lá,
    com as tags removidas — e o negrito vira **markdown**, que é o que ele é.
  */
  const html = readFileSync(join('_capturas', pasta, 'desktop.html'), 'utf8');
  const paragrafos = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => m[1]
      .replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '**$1**')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/\s+/g, ' ')
      .trim())
    .filter((t) => t.length > 60);

  // Sem duplicar: o Framer empilha os três breakpoints no mesmo HTML.
  const corpo = [...new Set(paragrafos)];

  // Imagens, na ordem em que aparecem na página.
  const imagens = dados.elementos
    .filter((e) => e.imagem && e.imagem.src && e.imagem.src.includes('framerusercontent'))
    .sort((a, b) => a.caixa.y - b.caixa.y);

  /*
    As imagens ficam ao lado do markdown, não em src/assets/.
    O `image()` do schema resolve caminho RELATIVO AO ARQUIVO .md — apontar
    para src/assets/ daria ImageNotFound. É a mesma disposição que os 25
    artigos já usam (src/content/artigos/imagens/).
  */
  const destino = join('src/content/projetos', slug);
  mkdirSync(destino, { recursive: true });
  const copiadas = [];
  for (const [i, el] of imagens.entries()) {
    const origem = achaArquivo(el.imagem.src);
    if (!origem) { console.log(`  ! sem arquivo local: ${el.imagem.src.slice(0, 70)}`); continue; }
    const ext = origem.match(/\.(png|jpe?g|webp|avif)/i)?.[1] ?? 'jpg';
    const nome = `${String(i + 1).padStart(2, '0')}.${ext.toLowerCase()}`;
    copyFileSync(join(DIR_IMAGENS, origem), join(destino, nome));
    copiadas.push(nome);
    semAlt.push(`${slug}/${nome}`);
  }
  if (!copiadas.length) { console.error(`${slug}: nenhuma imagem copiada`); continue; }

  const [capa, ...galeria] = copiadas;
  const resumo = corpo[0] ? corpo[0].slice(0, 240) : `Projeto ${titulo}.`;

  const fm = [
    '---',
    `titulo: ${JSON.stringify(titulo)}`,
    `resumo: ${JSON.stringify(resumo)}`,
    `capa: ./${slug}/${capa}`,
    'capaAlt: ""  # TODO(gabriel): descrever a imagem',
    'galeria:',
    ...galeria.map((g) => `  - imagem: ./${slug}/${g}\n    alt: ""  # TODO(gabriel)`),
    `categoria: ${JSON.stringify(categoria)}`,
    ficha['Ano'] ? `ano: ${parseInt(ficha['Ano'], 10)}` : null,
    ficha['Localização'] ? `local: ${JSON.stringify(ficha['Localização'])}` : null,
    `ordem: ${ordem}`,
    `slugAntigo: ${JSON.stringify('/projetos/' + slug)}`,
    '---',
    '',
    ...corpo.map((p) => p + '\n'),
  ].filter((l) => l !== null).join('\n');

  mkdirSync('src/content/projetos', { recursive: true });
  writeFileSync(join('src/content/projetos', `${slug}.md`), fm);
  console.log(`✓ ${slug.padEnd(12)} "${titulo}" · ${copiadas.length} imagens · ${corpo.length} parágrafos`);
}

console.log(`\n${semAlt.length} imagens sem alt — texto é do Gabriel, não se inventa:`);
semAlt.forEach((i) => console.log('  ' + i));

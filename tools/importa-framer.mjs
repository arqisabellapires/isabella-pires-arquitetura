#!/usr/bin/env node
/**
 * Converte os CSV exportados do Framer (plugin "CMS Export") em markdown
 * das coleções do Astro.
 *
 *   node tools/importa-framer.mjs _importar/artigos.csv artigos
 *   node tools/importa-framer.mjs _importar/projetos.csv projetos
 *
 * O Framer nomeia as colunas conforme os campos da coleção, então o mapeamento
 * abaixo aceita vários apelidos por campo — imprime o que não reconheceu para
 * ajustar à mão em vez de descartar em silêncio.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [arquivo, colecao] = process.argv.slice(2);
if (!arquivo || !colecao) {
  console.error('uso: node tools/importa-framer.mjs <arquivo.csv> <artigos|projetos>');
  process.exit(1);
}
if (!existsSync(arquivo)) {
  console.error(`✗ não encontrei ${arquivo}`);
  process.exit(1);
}

/** Parser de CSV que respeita aspas, vírgulas internas e quebras de linha. */
function parseCsv(texto) {
  const linhas = [];
  let campo = '', linha = [], dentroDeAspas = false;
  const t = texto.replace(/\r\n/g, '\n');
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; } else { dentroDeAspas = false; }
      } else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === ',') { linha.push(campo); campo = ''; }
    else if (c === '\n') { linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((c) => c.trim()));
}

/** Remove acento e normaliza para slug ASCII — a decisão de URL do projeto. */
const paraSlug = (s) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
   .toLowerCase().trim()
   .replace(/[^a-z0-9]+/g, '-')
   .replace(/^-+|-+$/g, '')
   .slice(0, 80);

const APELIDOS = {
  titulo: ['title', 'titulo', 'título', 'nome', 'name'],
  slug: ['slug', 'path', 'url'],
  resumo: ['excerpt', 'resumo', 'descricao', 'descrição', 'description', 'subtitle', 'subtítulo'],
  capa: ['image', 'cover', 'capa', 'thumbnail', 'imagem', 'featured image'],
  corpo: ['content', 'body', 'conteudo', 'conteúdo', 'texto', 'rich text'],
  publicadoEm: ['date', 'data', 'published', 'publicado', 'created', 'createdat'],
  categoria: ['category', 'categoria', 'categorias', 'tipo'],
  autor: ['autor', 'author', 'nome', 'name'],
  capaAlt: ['capa:alt', 'cover:alt', 'image:alt', 'imagem:alt', 'alt'],
  seoDescricao: ['meta description', 'metadescription', 'seo description', 'descrição seo'],
  tags: ['keywords', 'palavras-chave', 'palavras chave', 'tags'],
  local: ['location', 'local', 'cidade'],
  ano: ['year', 'ano'],
  areaM2: ['area', 'área', 'metragem', 'm2'],
};

const acha = (cabecalho, campo) => {
  const alvos = APELIDOS[campo] ?? [];
  return cabecalho.findIndex((h) => alvos.includes(h.toLowerCase().trim()));
};

const escapaYaml = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

const linhas = parseCsv(readFileSync(arquivo, 'utf8'));
const cabecalho = linhas[0];
const registros = linhas.slice(1);

const idx = Object.fromEntries(Object.keys(APELIDOS).map((c) => [c, acha(cabecalho, c)]));
const naoMapeadas = cabecalho.filter(
  (h, i) => !Object.values(idx).includes(i) && h.trim()
);

const destino = join('src/content', colecao);
mkdirSync(destino, { recursive: true });
mkdirSync('_importar/imagens', { recursive: true });

const pega = (linha, campo) => (idx[campo] >= 0 ? (linha[idx[campo]] ?? '').trim() : '');
const imagens = new Set();
const longas = [];
let gravados = 0;

for (const linha of registros) {
  const titulo = pega(linha, 'titulo');
  if (!titulo) continue;

  const slugAntigo = pega(linha, 'slug');
  const slug = paraSlug(slugAntigo || titulo);
  const capaUrl = pega(linha, 'capa');
  if (capaUrl) imagens.add(capaUrl);

  const dataBruta = pega(linha, 'publicadoEm');
  const data = dataBruta && !Number.isNaN(Date.parse(dataBruta))
    ? new Date(dataBruta).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  // O Framer não tem campo "resumo"; a Meta Description é o texto curto
  // que a arquiteta de fato escreveu, então serve melhor que um aviso.
  const metaDesc = pega(linha, 'seoDescricao');
  const resumo = pega(linha, 'resumo') || metaDesc || 'REVISAR: resumo ausente no export.';
  const corta = (t, n) => (t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`);

  const campos = [
    `titulo: ${escapaYaml(corta(titulo, 120))}`,
    `resumo: ${escapaYaml(corta(resumo, 300))}`,
    `capa: ${escapaYaml(capaUrl ? `./imagens/${slug}.jpg` : './imagens/placeholder.jpg')}`,
    `capaAlt: ${escapaYaml(pega(linha, 'capaAlt') || titulo)}`,
  ];

  const autor = pega(linha, 'autor');
  if (autor) campos.push(`autor: ${escapaYaml(autor)}`);

  // seoDescricao tem teto de 160 no schema. Cortar em silêncio seria pior
  // que omitir: melhor deixar o campo de fora e a página cair no resumo.
  if (metaDesc && metaDesc.length <= 160) campos.push(`seoDescricao: ${escapaYaml(metaDesc)}`);
  else if (metaDesc) longas.push(`${slug} (${metaDesc.length} caracteres)`);

  const tags = pega(linha, 'tags')
    .split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
  if (tags.length) campos.push(`tags: [${tags.map(escapaYaml).join(', ')}]`);

  if (colecao === 'artigos') {
    campos.push(`publicadoEm: ${data}`);
    campos.push(`categoria: ${escapaYaml(pega(linha, 'categoria') || 'Arquitetura')}`);
  } else {
    const cat = pega(linha, 'categoria');
    const valida = ['Residencial', 'Comercial', 'Interiores', 'Reforma'];
    campos.push(`categoria: ${escapaYaml(valida.includes(cat) ? cat : 'Residencial')}`);
    if (pega(linha, 'local')) campos.push(`local: ${escapaYaml(pega(linha, 'local'))}`);
    const ano = parseInt(pega(linha, 'ano'), 10);
    if (!Number.isNaN(ano)) campos.push(`ano: ${ano}`);
  }

  campos.push('publicado: true');
  if (slugAntigo && paraSlug(slugAntigo) !== slugAntigo) {
    campos.push(`slugAntigo: ${escapaYaml(slugAntigo)}`);
  }

  const corpo = pega(linha, 'corpo') || '> REVISAR: corpo não veio no export.';
  writeFileSync(join(destino, `${slug}.md`), `---\n${campos.join('\n')}\n---\n\n${corpo}\n`);
  gravados++;
}

writeFileSync('_importar/imagens-para-baixar.txt', [...imagens].join('\n'));

console.log(`✓ ${gravados} arquivo(s) em ${destino}`);
console.log(`✓ ${imagens.size} URL(s) de imagem em _importar/imagens-para-baixar.txt`);
if (longas.length) {
  console.log(`\n⚠ ${longas.length} Meta Description(s) acima de 160 caracteres, omitidas do seoDescricao:`);
  longas.slice(0, 6).forEach((l) => console.log(`   · ${l}`));
}
if (naoMapeadas.length) {
  console.log(`\n⚠ colunas do CSV que não reconheci (revisar à mão):`);
  naoMapeadas.forEach((c) => console.log(`   · ${c}`));
}

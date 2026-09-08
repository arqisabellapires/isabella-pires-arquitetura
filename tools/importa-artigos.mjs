/**
 * Carga inicial do CMS: leva os 25 artigos de src/content/artigos/ para o
 * Supabase, com as capas para o Storage.
 *
 * Roda uma vez (é idempotente: repetir só atualiza). Depois disso a fonte
 * de verdade é o banco, e estes markdown ficam como acervo.
 *
 *   node tools/importa-artigos.mjs [--seco]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const seco = process.argv.includes('--seco');
const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);

// Service role: esta é ferramenta de administração, roda na máquina do
// Gabriel e precisa escrever. A chave nunca vai para o navegador.
const supabase = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DIR = 'src/content/artigos';

/** Frontmatter YAML simples — o suficiente para o que estes arquivos usam. */
function leFrontmatter(texto) {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(texto);
  if (!m) throw new Error('sem frontmatter');
  const corpo = texto.slice(m[0].length).trim();
  const dados = {};
  for (const linha of m[1].split('\n')) {
    const mm = /^([a-zA-Z_]+):\s*(.*)$/.exec(linha);
    if (!mm) continue;
    let [, chave, valor] = mm;
    valor = valor.trim();
    if (valor.startsWith('[') && valor.endsWith(']')) {
      dados[chave] = valor.slice(1, -1).split(',')
        .map((v) => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    } else if (valor === 'true' || valor === 'false') {
      dados[chave] = valor === 'true';
    } else {
      dados[chave] = valor.replace(/^["']|["']$/g, '');
    }
  }
  return { dados, corpo };
}

const arquivos = readdirSync(DIR).filter((f) => f.endsWith('.md'));
console.log(`${arquivos.length} artigo(s) em ${DIR}\n`);

let enviados = 0;
for (const arquivo of arquivos.sort()) {
  const slug = basename(arquivo, '.md');
  const { dados, corpo } = leFrontmatter(readFileSync(join(DIR, arquivo), 'utf8'));

  // ── capa: sobe para o Storage e guarda a URL pública ──
  let urlCapa = null;
  let largura = null;
  let altura = null;
  const rel = (dados.capa || '').replace(/^\.\//, '');
  const local = join(DIR, rel);
  if (existsSync(local)) {
    const nome = basename(local);
    // O <Image> exige as dimensões para imagem remota, senão a página pula
    // enquanto a capa carrega. Medimos aqui, uma vez.
    const meta = await sharp(local).metadata();
    largura = meta.width ?? null;
    altura = meta.height ?? null;
    if (!seco) {
      const bin = readFileSync(local);
      const tipo = nome.endsWith('.png') ? 'image/png'
        : nome.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      const { error } = await supabase.storage.from('artigos')
        .upload(`capas/${nome}`, bin, { contentType: tipo, upsert: true });
      if (error) { console.error(`  ✗ capa de ${slug}: ${error.message}`); continue; }
    }
    urlCapa = `${env.PUBLIC_SUPABASE_URL}/storage/v1/object/public/artigos/capas/${nome}`;
  } else {
    console.error(`  ✗ ${slug}: capa não encontrada (${local})`);
    continue;
  }

  const linha = {
    slug,
    titulo: dados.titulo,
    resumo: dados.resumo,
    capa: urlCapa,
    capa_largura: largura,
    capa_altura: altura,
    capa_alt: dados.capaAlt || dados.titulo,
    corpo,
    publicado_em: new Date(dados.publicadoEm).toISOString(),
    autor: dados.autor || 'Isabella Pires',
    categoria: dados.categoria || 'Arquitetura',
    tags: dados.tags || [],
    publicado: dados.publicado !== false,
    destaque: dados.destaque === true,
    seo_titulo: dados.seoTitulo || null,
    seo_descricao: dados.seoDescricao || null,
    slug_antigo: dados.slugAntigo || null,
  };

  if (seco) { console.log(`·  ${slug}  (${linha.categoria})`); enviados++; continue; }

  const { error } = await supabase.from('artigos').upsert(linha, { onConflict: 'slug' });
  if (error) console.error(`  ✗ ${slug}: ${error.message}`);
  else { console.log(`✓  ${slug}`); enviados++; }
}

console.log(`\n${seco ? 'simulação' : 'enviados'}: ${enviados}/${arquivos.length}`);

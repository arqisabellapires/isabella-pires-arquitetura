#!/usr/bin/env node
/**
 * Empacota tudo que veio do Framer e não está no git.
 *
 *   node tools/backup-framer.mjs
 *   DESTINO_BACKUP=/outro/lugar node tools/backup-framer.mjs
 *
 * Por que existe: a assinatura do Framer vence em 30/09/2026. Destas cinco
 * pastas, nenhuma é versionada — o fonte e o runtime porque são código
 * proprietário deles num repositório público, as outras por peso. Se este
 * disco morrer depois do vencimento, não há de onde tirar de novo: o site
 * original não existe mais.
 *
 * O manifesto é a parte que importa. "Fiz backup" não é verificação;
 * verificação é listar o que entrou, com tamanho e contagem de arquivos, e
 * conferir o sha256 do pacote depois de escrito.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';

const RAIZ = resolve(new URL('..', import.meta.url).pathname);
const DESTINO = process.env.DESTINO_BACKUP ?? join(process.env.HOME, 'backups', 'isabella-pires');

/** As cinco pastas do Framer que ficam fora do git, e por quê. */
const PASTAS = [
  ['_fonte-framer', 'fonte do Framer desempacotado dos source maps — 116 módulos; é de onde saem molas, variantes e máquinas de estado'],
  ['_capturas/_runtime', 'runtime JS do Framer e os source maps de origem'],
  ['_referencia', 'clone antigo, 1056 variantes de imagem e as fontes em disco'],
  ['_importar', 'Blog.csv do CMS do Framer e os originais das imagens do corpo dos artigos'],
  ['_capturas/_videos', 'gravações de referência das interações no Framer vivo (tools/grava-interacoes.mjs)'],
];

const conta = (dir) => {
  let arquivos = 0, bytes = 0;
  (function anda(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) anda(p);
      else { arquivos++; bytes += statSync(p).size; }
    }
  })(dir);
  return { arquivos, bytes };
};

const mb = (b) => (b / 1024 / 1024).toFixed(1) + ' MB';

mkdirSync(DESTINO, { recursive: true });

const presentes = [];
for (const [pasta, motivo] of PASTAS) {
  const caminho = join(RAIZ, pasta);
  if (!existsSync(caminho)) { console.log(`✗ ${pasta} — não existe, fora do pacote`); continue; }
  const { arquivos, bytes } = conta(caminho);
  presentes.push({ pasta, motivo, arquivos, bytes });
  console.log(`✓ ${pasta.padEnd(20)} ${String(arquivos).padStart(6)} arquivos  ${mb(bytes).padStart(10)}`);
}
if (!presentes.length) { console.error('nada a empacotar'); process.exit(1); }

const carimbo = new Date().toISOString().slice(0, 10);
const pacote = join(DESTINO, `framer-${carimbo}.tar.gz`);

console.log(`\nempacotando em ${pacote} …`);
execFileSync('tar', ['-czf', pacote, '-C', RAIZ, ...presentes.map((p) => p.pasta)], { stdio: 'inherit' });

// Confere o que entrou de verdade no pacote, não o que se pretendia pôr.
const dentro = execFileSync('tar', ['-tzf', pacote], { encoding: 'utf8', maxBuffer: 1 << 28 })
  .split('\n').filter((l) => l && !l.endsWith('/')).length;

const soma = await new Promise((ok, erro) => {
  const h = createHash('sha256');
  createReadStream(pacote).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', erro);
});

const esperado = presentes.reduce((s, p) => s + p.arquivos, 0);
const manifesto = {
  gerado: new Date().toISOString(),
  pacote,
  sha256: soma,
  tamanho: statSync(pacote).size,
  arquivosEsperados: esperado,
  arquivosNoPacote: dentro,
  confere: dentro === esperado,
  origem: 'https://authentic-learning-761482.framer.app — assinatura vence em 30/09/2026',
  aviso: 'Mesmo disco do repositório. Protege contra apagar sem querer e contra o vencimento do Framer; NÃO protege contra perda da máquina. Copiar para fora quando houver destino externo.',
  conteudo: presentes.map((p) => ({ ...p, tamanho: mb(p.bytes) })),
};
writeFileSync(join(DESTINO, `framer-${carimbo}.manifesto.json`), JSON.stringify(manifesto, null, 2) + '\n');

console.log(`\n${mb(manifesto.tamanho)}  sha256 ${soma.slice(0, 16)}…`);
console.log(`arquivos: ${dentro} no pacote / ${esperado} esperados  ${manifesto.confere ? '✓ confere' : '✗ NÃO CONFERE'}`);
console.log(`→ ${pacote}`);
console.log(`→ ${join(DESTINO, `framer-${carimbo}.manifesto.json`)}`);
if (!manifesto.confere) process.exit(1);

/**
 * Aplica os .sql de `supabase/migracoes/` no banco, em ordem de nome.
 *
 * Não há psql nesta máquina, e o PostgREST não executa DDL — então falamos
 * o protocolo do Postgres direto, pelo pooler. A senha é a
 * SUPABASE_DATABASE_PASSWORD do .env.
 *
 * Cada arquivo roda dentro de uma transação e é registrado em
 * `public._migracoes`; rodar de novo não repete o que já passou.
 *
 *   node tools/migra-supabase.mjs [--forcar <arquivo>]
 */
import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const ref = env.PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\./)?.[1];
if (!ref || !env.SUPABASE_DATABASE_PASSWORD) {
  console.error('faltam PUBLIC_SUPABASE_URL ou SUPABASE_DATABASE_PASSWORD no .env');
  process.exit(1);
}

const cliente = new pg.Client({
  connectionString: `postgresql://postgres.${ref}:${encodeURIComponent(env.SUPABASE_DATABASE_PASSWORD)}@aws-0-sa-east-1.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

await cliente.connect();
await cliente.query(`create table if not exists public._migracoes (
  arquivo text primary key, aplicada_em timestamptz not null default now())`);

const jaFeitas = new Set(
  (await cliente.query('select arquivo from public._migracoes')).rows.map((r) => r.arquivo),
);

const dir = 'supabase/migracoes';
const arquivos = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
let aplicadas = 0;

for (const arquivo of arquivos) {
  if (jaFeitas.has(arquivo)) { console.log(`·  ${arquivo} (já aplicada)`); continue; }
  const sql = readFileSync(join(dir, arquivo), 'utf8');
  try {
    await cliente.query('begin');
    await cliente.query(sql);
    await cliente.query('insert into public._migracoes (arquivo) values ($1)', [arquivo]);
    await cliente.query('commit');
    console.log(`✓  ${arquivo}`);
    aplicadas++;
  } catch (e) {
    await cliente.query('rollback');
    console.error(`✗  ${arquivo}\n   ${e.message}`);
    await cliente.end();
    process.exit(1);
  }
}

console.log(aplicadas ? `\n✓ ${aplicadas} migração(ões) aplicada(s)` : '\n✓ banco já estava em dia');
await cliente.end();

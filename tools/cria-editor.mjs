/**
 * Cria (ou atualiza) um acesso ao painel do blog.
 *
 *   node tools/cria-editor.mjs <email> "<Nome>"
 *
 * Gera uma senha aleatória e a imprime UMA vez — anote e entregue à pessoa
 * por um canal seguro; ela troca no primeiro acesso. Entrar na tabela
 * `editores` é o que dá permissão de escrever (ver migração 002).
 */
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const [email, nome] = process.argv.slice(2);
if (!email || !nome) {
  console.error('uso: node tools/cria-editor.mjs <email> "<Nome>"');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1)]; }),
);

const admin = createClient(env.PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// senha forte o suficiente para uso único, sem caracteres ambíguos
const senha = randomBytes(12).toString('base64url');

const { data: existentes } = await admin.auth.admin.listUsers();
const jaExiste = existentes?.users?.find((u) => u.email === email);

let id;
if (jaExiste) {
  id = jaExiste.id;
  await admin.auth.admin.updateUserById(id, { password: senha });
  console.log(`· usuário já existia — senha redefinida`);
} else {
  const { data, error } = await admin.auth.admin.createUser({
    email, password: senha, email_confirm: true,
  });
  if (error) { console.error('✗', error.message); process.exit(1); }
  id = data.user.id;
  console.log('✓ usuário criado');
}

const { error: erroEditor } = await admin.from('editores')
  .upsert({ id, nome }, { onConflict: 'id' });
if (erroEditor) { console.error('✗ editores:', erroEditor.message); process.exit(1); }

console.log(`✓ ${nome} <${email}> pode publicar`);
console.log(`\n  senha desta vez:  ${senha}\n`);
console.log('  Entregue por canal seguro. Ela não aparece de novo.');

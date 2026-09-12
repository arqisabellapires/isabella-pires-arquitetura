#!/usr/bin/env node
/**
 * Renova o token da Graph API do Instagram e diz o que fazer com ele.
 *
 * Por que existe: o token de longa duração vale 60 dias. Passou disso, o
 * feed de /sobre-nos e /contato para de girar e volta a mostrar os posts
 * fixos de `site.ts` — sem quebrar o site, mas sem atualizar também.
 *
 * Rode a cada ~50 dias:
 *
 *     node tools/renova-token-instagram.mjs
 *
 * Ele troca o token atual por um novo com 60 dias cheios, mostra a data de
 * validade e o comando para atualizar na Vercel. Não escreve no .env
 * sozinho de propósito: token é segredo, e sobrescrever arquivo de
 * ambiente sem o dono ver é jeito bom de perder o acesso.
 *
 * ─── Como obter o PRIMEIRO token (só uma vez) ────────────────────────
 *
 * 1. A conta @arq.isabellapires precisa ser Business ou Creator e estar
 *    vinculada a uma Página do Facebook. (Já está.)
 * 2. Em developers.facebook.com, crie um app do tipo "Business".
 * 3. Adicione o produto "Instagram Graph API".
 * 4. No Graph API Explorer, selecione o app e peça as permissões
 *    `instagram_basic` e `pages_show_list`; gere o token de usuário.
 * 5. Descubra o id da conta:
 *      GET /me/accounts                → pega o id da Página
 *      GET /<id-da-pagina>?fields=instagram_business_account
 *    O `instagram_business_account.id` é o INSTAGRAM_CONTA_ID.
 * 6. Guarde no .env (e na Vercel):
 *      INSTAGRAM_TOKEN=...
 *      INSTAGRAM_CONTA_ID=...
 *      INSTAGRAM_APP_ID=...        (só para este script)
 *      INSTAGRAM_APP_SECRET=...    (só para este script)
 */
import { readFileSync } from 'node:fs';

/* Lê o .env sem depender de pacote: o script roda solto, fora do Astro. */
function leEnv() {
  const env = { ...process.env };
  try {
    for (const linha of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
      const m = linha.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* sem .env: seguimos só com o ambiente */
  }
  return env;
}

const env = leEnv();
const faltando = ['INSTAGRAM_TOKEN', 'INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET'].filter(
  (v) => !env[v],
);

if (faltando.length) {
  console.error(`Faltam no .env: ${faltando.join(', ')}`);
  console.error('Veja o cabeçalho deste arquivo para obter o primeiro token.');
  process.exit(1);
}

const url =
  'https://graph.facebook.com/v21.0/oauth/access_token' +
  '?grant_type=fb_exchange_token' +
  `&client_id=${env.INSTAGRAM_APP_ID}` +
  `&client_secret=${env.INSTAGRAM_APP_SECRET}` +
  `&fb_exchange_token=${env.INSTAGRAM_TOKEN}`;

const resposta = await fetch(url);
const dados = await resposta.json();

if (!resposta.ok || !dados.access_token) {
  console.error('Não deu para renovar:', JSON.stringify(dados, null, 2));
  console.error(
    '\nSe o token já venceu, não há renovação possível — refaça o passo 4 ' +
      'do cabeçalho para gerar um novo.',
  );
  process.exit(1);
}

const dias = dados.expires_in ? Math.round(dados.expires_in / 86400) : 60;
const vence = new Date(Date.now() + dias * 86400_000);

console.log('\nToken novo:\n');
console.log(dados.access_token);
console.log(`\nVale ${dias} dias — até ${vence.toLocaleDateString('pt-BR')}.`);
console.log('\nAtualize nos dois lugares:\n');
console.log('  1. No .env local, a linha INSTAGRAM_TOKEN=');
console.log('  2. Na Vercel:');
console.log('       vercel env rm INSTAGRAM_TOKEN production');
console.log('       vercel env add INSTAGRAM_TOKEN production');
console.log('\nDepois disso, o próximo build já usa o token novo.\n');

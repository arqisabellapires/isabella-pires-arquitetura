-- ─────────────────────────────────────────────────────────────────────────
--  Quem pode ler e quem pode escrever
--
--  A `PUBLIC_SUPABASE_ANON_KEY` vai no navegador — ela é pública por
--  definição. Sem RLS, qualquer visitante poderia apagar o blog com um
--  DELETE. Por isso a tabela nasce com RLS ligada e nega tudo por padrão.
--
--  São dois acessos (decisão do Gabriel, 07/09/2026): a Isabella e o
--  Gabriel. Sem papéis distintos — quem está na tabela `editores` edita.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.editores (
  id     uuid primary key references auth.users (id) on delete cascade,
  nome   text not null,
  criado_em timestamptz not null default now()
);

comment on table public.editores is
  'Quem pode publicar. Entrar aqui é o que dá acesso ao painel.';

alter table public.editores enable row level security;
alter table public.artigos  enable row level security;

-- Um editor enxerga a própria lista de editores (para saber quem é quem);
-- ninguém mais enxerga.
drop policy if exists editores_leem_editores on public.editores;
create policy editores_leem_editores on public.editores
  for select to authenticated
  using (exists (select 1 from public.editores e where e.id = auth.uid()));

-- ── artigos ──────────────────────────────────────────────────────────────

-- Qualquer um (inclusive o visitante anônimo) lê o que está PUBLICADO.
-- Rascunho não vaza: `publicado = false` fica fora desta política.
drop policy if exists artigos_publicos_leem on public.artigos;
create policy artigos_publicos_leem on public.artigos
  for select to anon, authenticated
  using (publicado);

-- O editor enxerga tudo, rascunho incluído.
drop policy if exists artigos_editores_leem on public.artigos;
create policy artigos_editores_leem on public.artigos
  for select to authenticated
  using (exists (select 1 from public.editores e where e.id = auth.uid()));

-- Só editor escreve. As três operações são separadas de propósito: é mais
-- fácil auditar, e mais fácil restringir depois se aparecer papel de autor.
drop policy if exists artigos_editores_inserem on public.artigos;
create policy artigos_editores_inserem on public.artigos
  for insert to authenticated
  with check (exists (select 1 from public.editores e where e.id = auth.uid()));

drop policy if exists artigos_editores_alteram on public.artigos;
create policy artigos_editores_alteram on public.artigos
  for update to authenticated
  using      (exists (select 1 from public.editores e where e.id = auth.uid()))
  with check (exists (select 1 from public.editores e where e.id = auth.uid()));

drop policy if exists artigos_editores_apagam on public.artigos;
create policy artigos_editores_apagam on public.artigos
  for delete to authenticated
  using (exists (select 1 from public.editores e where e.id = auth.uid()));

-- ── imagens ──────────────────────────────────────────────────────────────
-- Bucket público para leitura (as capas aparecem no site), escrita só de
-- editor.
insert into storage.buckets (id, name, public)
values ('artigos', 'artigos', true)
on conflict (id) do nothing;

drop policy if exists capas_todos_leem on storage.objects;
create policy capas_todos_leem on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'artigos');

drop policy if exists capas_editores_enviam on storage.objects;
create policy capas_editores_enviam on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artigos'
              and exists (select 1 from public.editores e where e.id = auth.uid()));

drop policy if exists capas_editores_apagam on storage.objects;
create policy capas_editores_apagam on storage.objects
  for delete to authenticated
  using (bucket_id = 'artigos'
         and exists (select 1 from public.editores e where e.id = auth.uid()));

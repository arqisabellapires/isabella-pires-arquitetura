-- ─────────────────────────────────────────────────────────────────────────
--  Conserta a recursão infinita nas políticas
--
--  Sintoma: qualquer leitura como editor devolvia
--  "infinite recursion detected in policy for relation editores".
--
--  Causa: a política de `editores` perguntava "existe uma linha em
--  `editores` com o meu id?" — e essa pergunta é ela mesma uma leitura de
--  `editores`, que dispara a política de novo, sem fim. As políticas de
--  `artigos` herdavam o problema porque também consultavam a tabela.
--
--  Conserto: uma função `security definer`, que roda com os privilégios de
--  quem a criou e por isso NÃO passa pela RLS. A pergunta deixa de ser
--  recursiva. `search_path` fixo para a função não ser sequestrada por uma
--  tabela homônima em outro schema.
-- ─────────────────────────────────────────────────────────────────────────

create or replace function public.e_editor()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.editores where id = auth.uid());
$$;

comment on function public.e_editor() is
  'Diz se quem está pedindo é editor. security definer para não recorrer na RLS.';

revoke all on function public.e_editor() from public;
grant execute on function public.e_editor() to authenticated;

-- ── refaz as políticas usando a função ──

drop policy if exists editores_leem_editores on public.editores;
create policy editores_leem_editores on public.editores
  for select to authenticated
  using (public.e_editor());

drop policy if exists artigos_editores_leem on public.artigos;
create policy artigos_editores_leem on public.artigos
  for select to authenticated
  using (public.e_editor());

drop policy if exists artigos_editores_inserem on public.artigos;
create policy artigos_editores_inserem on public.artigos
  for insert to authenticated
  with check (public.e_editor());

drop policy if exists artigos_editores_alteram on public.artigos;
create policy artigos_editores_alteram on public.artigos
  for update to authenticated
  using (public.e_editor()) with check (public.e_editor());

drop policy if exists artigos_editores_apagam on public.artigos;
create policy artigos_editores_apagam on public.artigos
  for delete to authenticated
  using (public.e_editor());

drop policy if exists capas_editores_enviam on storage.objects;
create policy capas_editores_enviam on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artigos' and public.e_editor());

drop policy if exists capas_editores_apagam on storage.objects;
create policy capas_editores_apagam on storage.objects
  for delete to authenticated
  using (bucket_id = 'artigos' and public.e_editor());

-- Trocar a capa é UPDATE no objeto; sem esta política, reenviar com upsert
-- falha para quem não é dono do arquivo.
drop policy if exists capas_editores_trocam on storage.objects;
create policy capas_editores_trocam on storage.objects
  for update to authenticated
  using (bucket_id = 'artigos' and public.e_editor())
  with check (bucket_id = 'artigos' and public.e_editor());

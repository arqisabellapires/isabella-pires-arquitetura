-- ─────────────────────────────────────────────────────────────────────────
--  CMS do blog — tabela de artigos
--
--  As colunas espelham UMA A UMA o schema de `artigos` em
--  src/content.config.ts. Isso é deliberado: o loader do Astro lê daqui e
--  entrega o mesmo formato que o glob() de markdown entregava, então as
--  páginas que consomem getCollection('artigos') não mudam.
--
--  Decidido em 07/09/2026: Supabase (e não markdown-no-repo), dois acessos
--  (Isabella e Gabriel), e o site atualiza por rebuild via webhook.
-- ─────────────────────────────────────────────────────────────────────────

create table if not exists public.artigos (
  -- o `id` do Astro é o slug: é ele que forma a URL /artigos/<slug>
  slug            text primary key
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  titulo          text not null check (length(titulo) between 1 and 120),
  resumo          text not null check (length(resumo) between 1 and 300),

  -- caminho da capa dentro do bucket de imagens, e a descrição.
  -- `capa_alt` é NOT NULL de propósito: o portão audita-paginas reprova
  -- imagem sem alt, então o banco não deixa entrar artigo sem descrição.
  capa            text not null,
  capa_alt        text not null check (length(trim(capa_alt)) > 0),

  corpo           text not null default '',

  publicado_em    timestamptz not null default now(),
  atualizado_em   timestamptz,

  autor           text not null default 'Isabella Pires',
  categoria       text not null default 'Arquitetura',
  tags            text[] not null default '{}',

  publicado       boolean not null default true,
  destaque        boolean not null default false,

  seo_titulo      text check (seo_titulo is null or length(seo_titulo) <= 60),
  seo_descricao   text check (seo_descricao is null or length(seo_descricao) <= 160),
  slug_antigo     text,

  criado_em       timestamptz not null default now(),
  -- quem escreveu; serve para saber de quem é o rascunho
  criado_por      uuid references auth.users (id) on delete set null
);

comment on table public.artigos is
  'Artigos do blog. Espelha o schema de src/content.config.ts.';

-- A listagem sempre pede publicados, do mais novo para o mais velho.
create index if not exists artigos_publicados_idx
  on public.artigos (publicado_em desc)
  where publicado;

create index if not exists artigos_categoria_idx
  on public.artigos (categoria)
  where publicado;

-- `atualizado_em` é mantido pelo banco, não pelo editor: assim ele nunca
-- mente, e o <time> do artigo pode confiar nele.
create or replace function public.toca_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(new) - 'atualizado_em' is distinct from to_jsonb(old) - 'atualizado_em' then
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

drop trigger if exists artigos_atualizado_em on public.artigos;
create trigger artigos_atualizado_em
  before update on public.artigos
  for each row execute function public.toca_atualizado_em();

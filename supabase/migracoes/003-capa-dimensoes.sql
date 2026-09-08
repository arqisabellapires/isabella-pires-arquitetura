-- ─────────────────────────────────────────────────────────────────────────
--  Largura e altura da capa
--
--  O <Image> do Astro consegue medir um arquivo local, mas não uma URL
--  remota — e sem as duas dimensões ele se recusa a montar a imagem, para
--  não deixar a página "pular" enquanto a capa carrega (CLS).
--
--  Então o tamanho passa a viver junto do artigo. Quem envia a capa mede a
--  imagem e grava aqui; o editor faz isso sozinho.
-- ─────────────────────────────────────────────────────────────────────────

alter table public.artigos
  add column if not exists capa_largura integer
    check (capa_largura is null or capa_largura > 0),
  add column if not exists capa_altura integer
    check (capa_altura is null or capa_altura > 0);

comment on column public.artigos.capa_largura is
  'Largura em px da imagem de capa. O <Image> exige para imagem remota.';

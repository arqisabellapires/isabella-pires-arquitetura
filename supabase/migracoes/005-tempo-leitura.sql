-- Tempo de leitura, para espelhar a coluna que o CMS do Framer mostrava.
--
-- É calculado a partir do corpo quando o editor salva (200 palavras/min),
-- mas fica gravado numa coluna própria para que a Isabella possa corrigir
-- o número à mão quando o cálculo não servir — foi o que o Gabriel pediu:
-- "calculando sozinho e podendo alterar".
--
-- Nulo = nunca foi calculado nem digitado; a lista mostra "—".
alter table public.artigos
  add column if not exists tempo_leitura smallint
    check (tempo_leitura is null or tempo_leitura between 1 and 120);

comment on column public.artigos.tempo_leitura is
  'Minutos de leitura. Calculado do corpo ao salvar, mas editável à mão.';

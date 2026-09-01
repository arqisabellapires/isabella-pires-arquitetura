/**
 * Leitura de variável de ambiente que funciona nos dois lados: em `astro dev`
 * os valores chegam por `import.meta.env`; na função da Vercel, por
 * `process.env`. Ler só um dos dois quebra num dos ambientes.
 */
export function env(nome: string): string | undefined {
  const deProcesso = typeof process !== 'undefined' ? process.env?.[nome] : undefined;
  const valor = deProcesso ?? (import.meta.env as Record<string, string | undefined>)[nome];
  const limpo = valor?.trim();
  return limpo ? limpo : undefined;
}

/** Igual a `env`, mas explode cedo — melhor falhar na primeira request que enviar vazio. */
export function envObrigatoria(nome: string): string {
  const valor = env(nome);
  if (!valor) throw new Error(`Variável de ambiente ausente: ${nome}`);
  return valor;
}

import type { CollectionEntry } from 'astro:content';

/**
 * Tempo de leitura em minutos, a 200 palavras/minuto.
 *
 * A captura do Framer mostra "6min", "7min", "3min" ao lado de cada card —
 * então o dado existe no original e não está sendo inventado aqui. O que não
 * dá para saber é a constante que eles usaram; 200 ppm é a convenção usual e
 * reproduz a ordem de grandeza medida. Se divergir de algum card, é ajuste de
 * constante, não de método.
 */
export async function minutosDeLeitura(artigo: CollectionEntry<'artigos'>): Promise<number> {
  const palavras = artigo.body?.trim().split(/\s+/).length ?? 0;
  return Math.max(1, Math.round(palavras / 200));
}

/** Categoria → slug ASCII, que é a decisão de URLs do HANDOFF §5. */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, 'e')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

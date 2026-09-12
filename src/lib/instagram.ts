/**
 * Os últimos posts do Instagram, buscados no BUILD.
 *
 * O problema que isto resolve: os três posts do feed de /sobre-nos e
 * /contato eram ids escritos à mão em `site.ts`. Eles não envelheciam
 * sozinhos — envelheciam porque ninguém os trocava. A Isabella pediu que
 * girassem.
 *
 * Como o site é `output: 'static'`, não há servidor para consultar a API a
 * cada visita: a busca acontece no build, e o rebuild já é automático (o
 * webhook do CMS e o cron da Vercel). Publicou post novo, o próximo build
 * o traz.
 *
 * **A API.** A Basic Display API foi desativada em dez/2024. O que resta é
 * a Graph API, que exige conta Business/Creator ligada a uma Página do
 * Facebook — a conta da Isabella já é. O token de longa duração vale 60
 * dias e é renovável; `tools/renova-token-instagram.mjs` faz isso.
 *
 * **Se falhar, o site não cai.** Sem token, com token vencido ou com a API
 * fora do ar, a função devolve os ids fixos de `site.ts`. Um feed um pouco
 * velho é muito melhor do que um build quebrado — e melhor ainda do que
 * uma seção vazia.
 */
import { site } from '~/lib/site';

/** O que a Graph API devolve por post, do que nos interessa. */
type PostGraph = {
  id: string;
  shortcode?: string;
  permalink: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';
  timestamp: string;
};

/** Quantos o feed mostra. A grade é de três. */
const QUANTOS = 3;

/**
 * O shortcode é o que vai na URL do embed (instagram.com/p/<shortcode>/).
 * A API nem sempre devolve o campo `shortcode`, mas o `permalink` sempre
 * traz — em /p/<code>/ para post e /reel/<code>/ para reel.
 */
function shortcodeDe(post: PostGraph): string | null {
  if (post.shortcode) return post.shortcode;
  const m = post.permalink?.match(/\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Busca os últimos posts. Nunca lança: qualquer falha vira o fallback dos
 * ids fixos, com um aviso no log do build para quem estiver olhando.
 */
export async function ultimosPosts(): Promise<readonly string[]> {
  const token = import.meta.env.INSTAGRAM_TOKEN;
  const conta = import.meta.env.INSTAGRAM_CONTA_ID;

  if (!token || !conta) {
    console.warn(
      '[instagram] INSTAGRAM_TOKEN ou INSTAGRAM_CONTA_ID ausente — ' +
        'usando os posts fixos de site.ts.',
    );
    return site.redes.postsInstagram;
  }

  try {
    const campos = 'id,shortcode,permalink,media_type,timestamp';
    const url =
      `https://graph.facebook.com/v21.0/${conta}/media` +
      `?fields=${campos}&limit=${QUANTOS * 3}&access_token=${token}`;

    /* Timeout curto: o build não pode ficar pendurado num terceiro. */
    const resposta = await fetch(url, { signal: AbortSignal.timeout(10_000) });

    if (!resposta.ok) {
      const corpo = await resposta.text().catch(() => '');
      throw new Error(`HTTP ${resposta.status} — ${corpo.slice(0, 200)}`);
    }

    const { data } = (await resposta.json()) as { data?: PostGraph[] };

    const codigos = (data ?? [])
      .map(shortcodeDe)
      .filter((c): c is string => Boolean(c))
      .slice(0, QUANTOS);

    /* Menos que a grade inteira ficaria pior que o feed antigo. */
    if (codigos.length < QUANTOS) {
      throw new Error(`a API devolveu ${codigos.length} post(s) utilizáveis`);
    }

    console.log(`[instagram] ${codigos.length} posts buscados: ${codigos.join(', ')}`);
    return codigos;
  } catch (erro) {
    console.warn(
      `[instagram] falhou (${erro instanceof Error ? erro.message : erro}) — ` +
        'usando os posts fixos de site.ts.',
    );
    return site.redes.postsInstagram;
  }
}

/**
 * Consentimento de cookies de medição.
 *
 * A regra que este arquivo existe para cumprir: **nada de medição roda antes
 * do aceite**. Por isso os scripts de GA4 e Clarity não estão mais no HTML
 * do `Base.astro` — eles são criados aqui, em tempo de execução, e só depois
 * de a pessoa clicar em "Aceitar".
 *
 * Recusar não injeta nada e fica registrado, para não perguntar de novo a
 * cada página.
 *
 * O estado mora em `localStorage`. Se o navegador bloquear o acesso (aba
 * anônima com site data desligado, por exemplo), tudo aqui degrada para
 * "sem consentimento": o banner reaparece e a medição não roda. Falhar para
 * o lado de não rastrear é o comportamento certo.
 */

const CHAVE = 'ip-consentimento-medicao';

export type Escolha = 'aceito' | 'recusado' | null;

export function lerEscolha(): Escolha {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'aceito' || v === 'recusado' ? v : null;
  } catch {
    return null;
  }
}

export function gravarEscolha(escolha: Exclude<Escolha, null>): void {
  try {
    localStorage.setItem(CHAVE, escolha);
  } catch {
    /* Sem localStorage a escolha vale só para esta página. Melhor do que
       quebrar o clique. */
  }
}

/**
 * Cria as tags de medição. Só deve ser chamada depois do aceite.
 *
 * `ja` evita injetar duas vezes se a função for chamada de novo (aceite
 * seguido de navegação por View Transitions, por exemplo).
 */
let ja = false;

export function ligarMedicao(ga4?: string, clarity?: string): void {
  if (ja || typeof document === 'undefined') return;
  ja = true;

  if (ga4) {
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.googletagmanager.com/gtag/js?id=${ga4}`;
    document.head.appendChild(tag);

    const w = window as unknown as { dataLayer?: unknown[] };
    w.dataLayer = w.dataLayer || [];
    // eslint-disable-next-line prefer-rest-params
    function gtag(...args: unknown[]) { w.dataLayer!.push(args); }
    gtag('js', new Date());
    /* `anonymize_ip` continua ligado: mesmo com consentimento, não há razão
       para guardar o IP inteiro de quem lê um artigo. */
    gtag('config', ga4, { anonymize_ip: true });
  }

  if (clarity) {
    const w = window as unknown as Record<string, unknown>;
    w.clarity = w.clarity || function (...args: unknown[]) {
      ((w.clarity as { q?: unknown[] }).q = (w.clarity as { q?: unknown[] }).q || []).push(args);
    };
    const tag = document.createElement('script');
    tag.async = true;
    tag.src = `https://www.clarity.ms/tag/${clarity}`;
    document.head.appendChild(tag);
  }
}

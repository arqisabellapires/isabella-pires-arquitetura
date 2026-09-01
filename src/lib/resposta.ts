/**
 * Os formulários funcionam com e sem JavaScript, então o endpoint responde em
 * dois formatos: JSON para o fetch de `formularios.js`, e um 303 de volta para
 * a página de origem quando o navegador postou o form direto. Sem isso, quem
 * estiver sem JS recebe um JSON cru na tela.
 */
export function responde(
  request: Request,
  resultado: { ok: boolean; erro?: string },
  status: number,
): Response {
  const querJson = (request.headers.get('accept') ?? '').includes('application/json');

  if (querJson) {
    return new Response(JSON.stringify(resultado), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const origem = request.headers.get('referer');
  const destino = new URL(origem ?? '/', request.url);
  destino.searchParams.set('envio', resultado.ok ? 'ok' : 'erro');
  return new Response(null, { status: 303, headers: { location: destino.toString() } });
}

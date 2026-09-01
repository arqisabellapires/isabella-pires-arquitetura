/**
 * Defesas do formulário, na ordem em que rodam.
 *
 * O HTML do Framer já traz 11 campos-isca escondidos. Reaproveitamos: robô que
 * preenche formulário por heurística de nome ("message", "subject", "company")
 * cai neles, e humano nenhum os vê.
 */
export const CAMPOS_ISCA = [
  'website', 'company', 'message', 'subject', 'title', 'description',
  'feedback', 'notes', 'details', 'remarks', 'comments',
] as const;

export function caiuNaIsca(dados: FormData): boolean {
  return CAMPOS_ISCA.some((campo) => String(dados.get(campo) ?? '').trim() !== '');
}

/**
 * Limite por IP, em memória.
 *
 * Ressalva honesta: cada instância da função tem o próprio mapa, então isto
 * segura repetição de um mesmo visitante, não um ataque distribuído. Para o
 * volume deste site é suficiente; se algum dia não for, o passo seguinte é
 * Upstash/KV, não afinar estes números.
 */
const JANELA_MS = 10 * 60 * 1000;
const MAXIMO = 5;
const historico = new Map<string, number[]>();

export function excedeuLimite(ip: string): boolean {
  const agora = Date.now();
  const recentes = (historico.get(ip) ?? []).filter((t) => agora - t < JANELA_MS);
  recentes.push(agora);
  historico.set(ip, recentes);

  // Poda oportunista: sem isto o mapa cresce enquanto a instância viver.
  if (historico.size > 500) {
    for (const [chave, marcas] of historico) {
      if (marcas.every((t) => agora - t >= JANELA_MS)) historico.delete(chave);
    }
  }

  return recentes.length > MAXIMO;
}

/** O bastante para barrar lixo óbvio sem recusar endereço válido e estranho. */
export function emailPlausivel(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor) && valor.length <= 254;
}

export function texto(dados: FormData, campo: string, limite: number): string {
  return String(dados.get(campo) ?? '').trim().slice(0, limite);
}

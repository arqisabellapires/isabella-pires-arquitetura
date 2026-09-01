/**
 * Servidor estático para as comparações. Procura porta livre e só devolve
 * depois de confirmar que a pasta está sendo servida de verdade.
 *
 * Porta ocupada por um servidor esquecido de outra sessão já custou uma
 * rodada inteira de verificação: o spawn morria calado, a referência vinha
 * 404, e toda página "divergia" 100% com altura de viewport.
 */
import { spawn } from 'node:child_process';

const vivos = [];
export const encerraServidores = () => { vivos.forEach((s) => s.kill()); vivos.length = 0; };
process.on('exit', encerraServidores);

export async function sobe(dir, sonda, portaInicial) {
  for (let porta = portaInicial; porta < portaInicial + 20; porta++) {
    const proc = spawn('python3', ['-m', 'http.server', String(porta)], { cwd: dir, stdio: 'ignore' });
    vivos.push(proc);
    await new Promise((r) => setTimeout(r, 700));
    try {
      if ((await fetch(`http://localhost:${porta}${sonda}`)).ok) return porta;
    } catch { /* porta ocupada ou ainda subindo */ }
    proc.kill();
    vivos.pop();
  }
  throw new Error(`não consegui servir ${dir} em nenhuma porta a partir de ${portaInicial}`);
}

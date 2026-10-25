import type { ContaDeLogin, Login, Registrador } from '../../application/portas';

/**
 * Banco fora do ar não pode impedir ninguém de jogar: quem não teve a sessão conferida entra como
 * convidado. Usado também pelo socket.
 */
export async function contaOuConvidado(
  login: Pick<Login, 'contaDoToken'>,
  token: string,
  registrador: Registrador,
): Promise<ContaDeLogin | null> {
  try {
    return await login.contaDoToken(token);
  } catch (erro) {
    registrador.warn({ erro }, 'Sessão de login não conferida: segue como convidado');
    return null;
  }
}

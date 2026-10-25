import type { ContaDeLogin, Login, SessaoDeLogin } from '../../application/portas';

/** Sem as variáveis do Google ou sem banco: ninguém loga, e todos jogam como convidado. */
export class LoginNulo implements Login {
  readonly ligado = false;

  async contaDoToken(): Promise<ContaDeLogin | null> {
    return null;
  }

  async trocarCodigo(): Promise<SessaoDeLogin | null> {
    return null;
  }

  async encerrar(): Promise<void> {}
}

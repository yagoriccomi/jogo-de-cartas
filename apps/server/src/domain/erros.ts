import type { CodigoErro } from '@fodinha/shared';

/** Violação de regra do jogo. A camada de transporte converte em `ErroDeJogo` para o cliente. */
export class ErroDeRegra extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = 'ErroDeRegra';
  }
}

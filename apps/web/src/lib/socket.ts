import { io, type Socket } from 'socket.io-client';
import type {
  CodigoErro,
  EventosClienteParaServidor,
  EventosServidorParaCliente,
  Resposta,
} from '@fodinha/shared';

export type SocketJogo = Socket<EventosServidorParaCliente, EventosClienteParaServidor>;

/** Função que dispara um emit passando o callback de ack. */
export type Envio<T> = (responder: (resposta: Resposta<T>) => void) => void;

export const URL_SERVIDOR = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3001';
const TEMPO_LIMITE_RESPOSTA_MS = 8000;

// autoConnect desligado: a conexão só abre depois que os ouvintes do armazém estão registrados.
export const socket: SocketJogo = io(URL_SERVIDOR, {
  transports: ['websocket'],
  autoConnect: false,
});

export class ErroDeRequisicao extends Error {
  readonly codigo: CodigoErro | 'SEM_RESPOSTA';

  constructor(codigo: CodigoErro | 'SEM_RESPOSTA', mensagem: string) {
    super(mensagem);
    this.name = 'ErroDeRequisicao';
    this.codigo = codigo;
  }
}

/** Converte o padrão "emit com ack" em Promise, com tempo limite para a UI nunca ficar presa. */
export function requisitar<T>(enviar: Envio<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const temporizador = setTimeout(() => {
      reject(new ErroDeRequisicao('SEM_RESPOSTA', 'O servidor não respondeu. Tente novamente.'));
    }, TEMPO_LIMITE_RESPOSTA_MS);

    enviar((resposta) => {
      clearTimeout(temporizador);
      if (resposta.ok) resolve(resposta.dados);
      else reject(new ErroDeRequisicao(resposta.erro.codigo, resposta.erro.mensagem));
    });
  });
}

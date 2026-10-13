import type { ConfiguracaoPartida } from './configuracao';
import type { EstadoPartidaVisivel } from './estado';

export const CODIGOS_ERRO = [
  'ENTRADA_INVALIDA',
  'SALA_NAO_ENCONTRADA',
  'SALA_CHEIA',
  'PARTIDA_EM_ANDAMENTO',
  'SEM_PERMISSAO',
  'FORA_DA_VEZ',
  'JOGADA_INVALIDA',
  'PALPITE_INVALIDO',
  'MUITAS_REQUISICOES',
  'ERRO_INTERNO',
] as const;
export type CodigoErro = (typeof CODIGOS_ERRO)[number];

export interface ErroDeJogo {
  readonly codigo: CodigoErro;
  readonly mensagem: string;
}

export type Resposta<T> = { ok: true; dados: T } | { ok: false; erro: ErroDeJogo };

export interface ParticipanteSala {
  readonly id: string;
  readonly apelido: string;
  readonly ehBot: boolean;
  readonly conectado: boolean;
  readonly ehAnfitriao: boolean;
}

export interface EstadoSala {
  readonly codigo: string;
  readonly configuracao: ConfiguracaoPartida;
  readonly participantes: readonly ParticipanteSala[];
  /** `true` enquanto há partida não encerrada; ao encerrar, o anfitrião pode iniciar outra. */
  readonly emPartida: boolean;
}

export interface SessaoJogador {
  readonly codigoSala: string;
  readonly jogadorId: string;
  /** Guardado no cliente para reconectar ao mesmo assento após queda de conexão. */
  readonly tokenSessao: string;
}

export interface EventosClienteParaServidor {
  'sala:criar': (
    dados: { apelido: string; configuracao: ConfiguracaoPartida },
    responder: (resposta: Resposta<SessaoJogador>) => void,
  ) => void;
  'sala:entrar': (
    dados: { codigoSala: string; apelido: string },
    responder: (resposta: Resposta<SessaoJogador>) => void,
  ) => void;
  'sala:reconectar': (
    dados: { codigoSala: string; tokenSessao: string },
    responder: (resposta: Resposta<SessaoJogador>) => void,
  ) => void;
  'sala:configurar': (
    dados: { configuracao: ConfiguracaoPartida },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  'sala:adicionarBot': (responder: (resposta: Resposta<null>) => void) => void;
  'sala:removerParticipante': (
    dados: { participanteId: string },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  'sala:iniciarPartida': (responder: (resposta: Resposta<null>) => void) => void;
  'sala:sair': (responder: (resposta: Resposta<null>) => void) => void;
  'jogo:palpitar': (
    dados: { quantidade: number },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  'jogo:jogarCarta': (
    dados: { cartaId: string },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
}

export interface EventosServidorParaCliente {
  'sala:estado': (estado: EstadoSala) => void;
  'jogo:estado': (estado: EstadoPartidaVisivel) => void;
}

import type { ConfiguracaoPartida } from './configuracao';
import type { EstadoPartidaVisivel } from './estado';

export const CODIGOS_ERRO = [
  'ENTRADA_INVALIDA',
  'SALA_NAO_ENCONTRADA',
  'SALA_CHEIA',
  'PARTIDA_EM_ANDAMENTO',
  'SEM_PERMISSAO',
  'BANIDO',
  'FORA_DA_VEZ',
  'JOGADA_INVALIDA',
  'PALPITE_INVALIDO',
  'JOGO_PAUSADO',
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
  /** O dono da sala: quem a criou (ou, se ele saiu, quem está há mais tempo). */
  readonly ehAnfitriao: boolean;
  /** Entrou com a partida em andamento: senta na próxima rodada. */
  readonly aguardandoProximaRodada: boolean;
  /** Saiu ou foi expulso no meio da rodada: some da sala quando a rodada terminar. */
  readonly saindo: boolean;
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

/**
 * Identificador aleatório guardado no navegador. É o que permite barrar quem foi expulso
 * (sem login, uma aba anônima ou outro aparelho escapam do bloqueio).
 */
export interface IdentificacaoDispositivo {
  readonly dispositivoId: string;
}

export interface EventosClienteParaServidor {
  'sala:criar': (
    dados: { apelido: string; configuracao: ConfiguracaoPartida } & IdentificacaoDispositivo,
    responder: (resposta: Resposta<SessaoJogador>) => void,
  ) => void;
  'sala:entrar': (
    dados: { codigoSala: string; apelido: string } & IdentificacaoDispositivo,
    responder: (resposta: Resposta<SessaoJogador>) => void,
  ) => void;
  'sala:reconectar': (
    dados: { codigoSala: string; tokenSessao: string } & IdentificacaoDispositivo,
    responder: (resposta: Resposta<SessaoJogador>) => void,
  ) => void;
  'sala:configurar': (
    dados: { configuracao: ConfiguracaoPartida },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  'sala:adicionarBot': (responder: (resposta: Resposta<null>) => void) => void;
  /** Só o dono. Humano expulso fica banido da sala; bot é apenas removido. */
  'sala:expulsar': (
    dados: { participanteId: string },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  'sala:iniciarPartida': (responder: (resposta: Resposta<null>) => void) => void;
  /** Só o dono: volta à rodada 1 com as vidas iniciais para todos. */
  'sala:reiniciar': (responder: (resposta: Resposta<null>) => void) => void;
  'sala:sair': (responder: (resposta: Resposta<null>) => void) => void;
  'jogo:palpitar': (
    dados: { quantidade: number },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  'jogo:jogarCarta': (
    dados: { cartaId: string },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
  /** Voto na pausa: `true` = esperar o retorno, `false` = seguir sem ele. Pode ser trocado. */
  'jogo:votarEspera': (
    dados: { ausenteId: string; esperar: boolean },
    responder: (resposta: Resposta<null>) => void,
  ) => void;
}

export interface EventosServidorParaCliente {
  'sala:estado': (estado: EstadoSala) => void;
  'jogo:estado': (estado: EstadoPartidaVisivel) => void;
  /** Enviado a quem o dono expulsou, logo antes de desvinculá-lo da sala. */
  'sala:expulso': (aviso: { mensagem: string }) => void;
}

import type { EstadoPartidaVisivel, EstadoSala, SessaoJogador } from '@fodinha/shared';

/** Não existe sala de verdade no replay: o código só aparece no menu, e nada é enviado. */
export const CODIGO_DO_REPLAY = 'REPLAY';

export function sessaoDoReplay(jogadorId: string): SessaoJogador {
  return { codigoSala: CODIGO_DO_REPLAY, jogadorId, tokenSessao: '' };
}

/**
 * A sala que a mesa espera, montada dos jogadores do lance. Ninguém é dono: o menu não oferece
 * pausar, reiniciar nem expulsar numa partida que já acabou.
 */
export function salaDoReplay(jogo: EstadoPartidaVisivel): EstadoSala {
  return {
    codigo: CODIGO_DO_REPLAY,
    configuracao: jogo.configuracao,
    participantes: jogo.jogadores.map((jogador) => ({
      id: jogador.id,
      apelido: jogador.apelido,
      ehBot: jogador.ehBot,
      conectado: true,
      ehAnfitriao: false,
      aguardandoProximaRodada: false,
      saindo: false,
    })),
    emPartida: true,
  };
}

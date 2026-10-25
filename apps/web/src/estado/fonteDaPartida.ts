import type { ConfiguracaoPartida, Reacao } from '@fodinha/shared';

/**
 * Tudo o que a tela pede durante a partida. Cada fonte responde a todas, nem que seja recusando:
 * assim uma ação esquecida no tutorial não escapa para o servidor só porque o botão estava oculto.
 */
export interface AcoesDaPartida {
  sair(): Promise<void>;
  configurarSala(configuracao: ConfiguracaoPartida): Promise<boolean>;
  definirMortosVeemCartas(permitir: boolean): Promise<boolean>;
  adicionarBot(): Promise<boolean>;
  expulsarParticipante(participanteId: string): Promise<boolean>;
  iniciarPartida(): Promise<boolean>;
  reiniciarSala(): Promise<boolean>;
  pausarPartida(): Promise<boolean>;
  retomarPartida(): Promise<boolean>;
  /** `false` = o resumo abre sem pausar a mesa (cortesia recusada), nunca um erro. */
  lerRegras(): Promise<boolean>;
  pararDeLerRegras(): Promise<boolean>;
  palpitar(quantidade: number): Promise<boolean>;
  jogarCarta(cartaId: string): Promise<boolean>;
  votarEspera(ausenteId: string, esperar: boolean): Promise<boolean>;
  reagir(reacao: Reacao): Promise<boolean>;
}

/**
 * Quem alimenta `sessao`, `sala` e `jogo` do armazém e responde às ações. É um campo só do
 * armazém: "tutorial (ou replay) ligado" e "quem responde" nunca discordam. O servidor não guarda as ações
 * aqui porque o adaptador dele depende do armazém (ficaria um ciclo de módulos).
 */
export type FonteDaPartida =
  | { readonly origem: 'servidor' }
  | {
      readonly origem: 'tutorial';
      /** Passo atual do roteiro (índice). */
      readonly passo: number;
      readonly acoes: AcoesDaPartida;
    }
  | {
      /** Rever uma partida terminada: a mesa mostra lances gravados e ninguém joga. */
      readonly origem: 'replay';
      readonly idPartida: string;
      readonly totalDeRodadas: number;
      /** Rodada a partir de 1; lance a partir de 0, dentro dos `lancesNaRodada`. */
      readonly rodada: number;
      readonly lance: number;
      readonly lancesNaRodada: number;
      readonly tocando: boolean;
      /** Buscando a próxima rodada no servidor: os controles esperam. */
      readonly carregando: boolean;
      readonly acoes: AcoesDaPartida;
    };

export type OrigemDoEstado = FonteDaPartida['origem'];

export const FONTE_DO_SERVIDOR: FonteDaPartida = { origem: 'servidor' };

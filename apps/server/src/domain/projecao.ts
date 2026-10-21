import type {
  Carta,
  CartaNaMao,
  ConfiguracaoPartida,
  FasePartida,
  Jogada,
  JogadaNaMesa,
  ResultadoJogadorNaRodada,
  Valor,
  VazaEmpatada,
  VazaGanha,
  VazaResolvida,
} from '@fodinha/shared';
import { NAIPES } from '@fodinha/shared';
import { forcaDaCarta } from './forca';
import { organizarMesa } from './vaza';

/** Projeção do jogador para quem observa; dados de sala (apelido, bot, conexão) vêm da aplicação. */
export interface JogadorNaVisao {
  readonly id: string;
  readonly vidas: number;
  readonly eliminado: boolean;
  readonly palpite: number | null;
  readonly vazasFeitas: number;
  readonly vazasGanhas: readonly VazaGanha[];
  readonly cartasNaMao: number;
  readonly cartaNaTesta: Carta | null;
  readonly maoRevelada: readonly Carta[] | null;
  readonly saiAoFimDaRodada: boolean;
}

export interface VisaoDaPartida {
  readonly configuracao: ConfiguracaoPartida;
  readonly fase: FasePartida;
  readonly numeroRodada: number;
  readonly cartasPorJogador: number;
  readonly rodadaCega: boolean;
  readonly vira: Carta | null;
  readonly manilha: Valor | null;
  readonly jogadores: readonly JogadorNaVisao[];
  readonly idDoPe: string | null;
  readonly idDoPrimeiro: string | null;
  readonly idDaVez: string | null;
  readonly minhaMao: readonly CartaNaMao[];
  readonly mesa: readonly JogadaNaMesa[];
  readonly ultimaVaza: VazaResolvida | null;
  readonly vazasEmpatadas: readonly VazaEmpatada[];
  readonly palpiteProibido: number | null;
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
  readonly vencedores: readonly string[];
}

export interface JogadorNoRetrato {
  readonly id: string;
  readonly vidas: number;
  readonly eliminado: boolean;
  readonly mao: readonly Carta[];
  readonly palpite: number | null;
  readonly vazasGanhas: readonly VazaGanha[];
  readonly saiAoFimDaRodada: boolean;
}

/**
 * Estado completo da partida, com todas as mãos. Só a `Partida` o monta e só `projetarPara` o lê:
 * nunca vai direto a um cliente.
 */
export interface RetratoDaPartida {
  readonly configuracao: ConfiguracaoPartida;
  readonly fase: FasePartida;
  readonly numeroRodada: number;
  readonly cartasPorJogador: number;
  readonly rodadaCega: boolean;
  readonly vira: Carta | null;
  readonly manilha: Valor | null;
  readonly valores: readonly Valor[];
  readonly jogadores: readonly JogadorNoRetrato[];
  readonly idDoPe: string | null;
  readonly idDoPrimeiro: string | null;
  readonly idDaVez: string | null;
  readonly mesa: readonly Jogada[];
  readonly ultimaVaza: VazaResolvida | null;
  readonly vazasEmpatadas: readonly VazaEmpatada[];
  /** O número que o pé não pode dizer agora; a projeção decide quem fica sabendo. */
  readonly palpiteProibidoDoPe: number | null;
  readonly resultadoRodada: readonly ResultadoJogadorNaRodada[] | null;
  readonly vencedores: readonly string[];
}

/**
 * Visão sem mão alheia revelada (salvo a carta na testa da rodada cega), para espectadores e
 * jogadores. Exceção: com `mortosVeemCartas`, o eliminado vê a mão dos outros.
 */
export function projetarPara(
  retrato: RetratoDaPartida,
  observadorId: string | null,
): VisaoDaPartida {
  const observador = retrato.jogadores.find((jogador) => jogador.id === observadorId) ?? null;
  const ehOPe = observador !== null && observador.id === retrato.idDoPe;
  return {
    configuracao: retrato.configuracao,
    fase: retrato.fase,
    numeroRodada: retrato.numeroRodada,
    cartasPorJogador: retrato.cartasPorJogador,
    rodadaCega: retrato.rodadaCega,
    vira: retrato.vira,
    manilha: retrato.manilha,
    jogadores: retrato.jogadores.map((jogador) => ({
      id: jogador.id,
      vidas: jogador.vidas,
      eliminado: jogador.eliminado,
      palpite: jogador.palpite,
      vazasFeitas: jogador.vazasGanhas.length,
      vazasGanhas: [...jogador.vazasGanhas],
      cartasNaMao: jogador.mao.length,
      cartaNaTesta: cartaNaTestaVistaPor(retrato, jogador, observador),
      maoRevelada: maoReveladaPara(retrato, jogador, observador),
      saiAoFimDaRodada: jogador.saiAoFimDaRodada,
    })),
    idDoPe: retrato.idDoPe,
    idDoPrimeiro: retrato.idDoPrimeiro,
    idDaVez: retrato.idDaVez,
    minhaMao: observador ? maoVistaPeloDono(retrato, observador) : [],
    mesa: organizarMesa(retrato.mesa, retrato.manilha as Valor, retrato.valores),
    ultimaVaza: retrato.ultimaVaza,
    vazasEmpatadas: [...retrato.vazasEmpatadas],
    palpiteProibido: ehOPe && retrato.fase === 'palpites' ? retrato.palpiteProibidoDoPe : null,
    resultadoRodada: retrato.resultadoRodada,
    vencedores: [...retrato.vencedores],
  };
}

function cartaNaTestaVistaPor(
  retrato: RetratoDaPartida,
  jogador: JogadorNoRetrato,
  observador: JogadorNoRetrato | null,
): Carta | null {
  if (!retrato.rodadaCega || jogador.id === observador?.id) return null;
  return jogador.mao[0] ?? null;
}

/** Eliminado não joga mais: ver a mão alheia não lhe dá vantagem, só diverte quem assiste. */
function maoReveladaPara(
  retrato: RetratoDaPartida,
  jogador: JogadorNoRetrato,
  observador: JogadorNoRetrato | null,
): Carta[] | null {
  const podeVer = retrato.configuracao.mortosVeemCartas && !!observador?.eliminado;
  if (!podeVer || jogador.id === observador?.id) return null;
  return ordenarDaMaisForte(retrato, jogador.mao);
}

function maoVistaPeloDono(retrato: RetratoDaPartida, dono: JogadorNoRetrato): CartaNaMao[] {
  if (retrato.rodadaCega) return dono.mao.map((carta) => ({ id: carta.id, oculta: true as const }));
  return ordenarDaMaisForte(retrato, dono.mao);
}

/** Da mais forte para a mais fraca; empate de valor desempata pelo naipe. */
function ordenarDaMaisForte(retrato: RetratoDaPartida, mao: readonly Carta[]): Carta[] {
  const forca = (carta: Carta) =>
    forcaDaCarta(carta, retrato.manilha as Valor, retrato.valores) * NAIPES.length +
    NAIPES.indexOf(carta.naipe);
  return [...mao].sort((a, b) => forca(b) - forca(a));
}

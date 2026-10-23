import type {
  Carta,
  CartaNaMao,
  ConfiguracaoPartida,
  EstadoPartidaVisivel,
  EstadoSala,
  FasePartida,
  Jogada,
  JogadaNaMesa,
  ResultadoJogadorNaRodada,
  Valor,
  VazaEmpatada,
  VazaGanha,
  VazaResolvida,
  VotacaoEspera,
} from '@fodinha/shared';
import { NAIPES } from '@fodinha/shared';
import type { ProximoPasso } from './agenda';
import { forcaDaCarta } from './forca';
import type { Partida } from './partida';
import type { Sala } from './sala';
import { organizarMesa } from './vaza';

/**
 * Quem recebe o quê. Servidor autoritativo: este módulo é a única fonte do que vai a cada cliente.
 * `projetarMesa` monta o pacote da sala inteira; `projetarPara` decide as cartas que cada
 * observador da partida enxerga.
 */

/** Projeção do jogador para quem observa; dados de sala (apelido, bot, conexão) entram em `projetarMesa`. */
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

/** Os instantes da agenda chegam como dado: o domínio não lê relógio. */
export interface InstantesDaMesa {
  readonly agora: number;
  /** O passo automático armado agora; `null` = nada agendado. */
  readonly passo: ProximoPasso | null;
}

export interface EstadoParaDestinatario {
  readonly destinatarioId: string;
  readonly estado: EstadoPartidaVisivel;
}

/** Tudo o que sai da sala numa publicação: a aplicação só entrega. */
export interface ProjecaoDaMesa {
  readonly destinatarios: readonly string[];
  readonly sala: EstadoSala;
  /** Um estado por destinatário, na ordem de `destinatarios`; vazio fora de partida. */
  readonly partidas: readonly EstadoParaDestinatario[];
}

/** Humanos que pertencem à sala. Quem saiu não recebe mais nada, mesmo com um bot jogando por ele. */
export function destinatariosDa(sala: Sala): string[] {
  return sala
    .ativos()
    .filter((p) => !p.ehBot)
    .map((p) => p.id);
}

export function projetarMesa(sala: Sala, instantes: InstantesDaMesa): ProjecaoDaMesa {
  const destinatarios = destinatariosDa(sala);
  const partida = sala.partida;
  return {
    destinatarios,
    sala: projetarSala(sala),
    partidas: partida
      ? destinatarios.map((destinatarioId) => ({
          destinatarioId,
          estado: estadoDaPartidaPara(sala, partida, destinatarioId, instantes),
        }))
      : [],
  };
}

export function projetarSala(sala: Sala): EstadoSala {
  const partida = sala.partida;
  return {
    codigo: sala.codigo,
    configuracao: sala.configuracaoAtual,
    emPartida: sala.emPartida,
    participantes: sala.todos.map((p) => ({
      id: p.id,
      apelido: p.apelido,
      ehBot: p.ehBot,
      conectado: p.conectado,
      ehAnfitriao: sala.ehAnfitriao(p.id),
      aguardandoProximaRodada: sala.emPartida && !!partida?.aguardandoEntrada(p.id),
      saindo: sala.estaSaindo(p.id),
    })),
  };
}

export function votacoesVisiveis(sala: Sala): VotacaoEspera[] {
  return sala.votacoesAbertas().map((votacao) => ({
    ausenteId: votacao.ausenteId,
    apelido: sala.participante(votacao.ausenteId)?.apelido ?? '—',
    desconectadoDesde: votacao.desde,
    votos: votacao.votos,
  }));
}

/** Quem não está sentado (entrou no meio, espera a próxima rodada) assiste como espectador. */
function estadoDaPartidaPara(
  sala: Sala,
  partida: Partida,
  destinatarioId: string,
  { agora, passo }: InstantesDaMesa,
): EstadoPartidaVisivel {
  const visao = partida.visaoPara(partida.participa(destinatarioId) ? destinatarioId : null);
  const restante = (tipo: ProximoPasso['tipo']) =>
    passo?.tipo === tipo ? Math.max(0, passo.em - agora) : null;
  const previsao = partida.previsaoDaProximaRodada();
  const leitura = sala.leituraDasRegras;
  return {
    ...visao,
    prazoDaVezEm: passo?.tipo === 'prazoDaVez' ? passo.em : null,
    prazoDaVezRestanteMs: restante('prazoDaVez'),
    proximaRodada: previsao && { ...previsao, comecaEmMs: restante('proximaRodada') },
    pausa: sala.pausada
      ? {
          votacoes: votacoesVisiveis(sala),
          pausadaPeloDono: sala.pausadaPeloDono,
          lendoRegras: leitura && {
            jogadorId: leitura.jogadorId,
            restanteMs: restante('fimDaLeitura') ?? 0,
          },
        }
      : null,
    jogadores: visao.jogadores.map((jogador) => {
      const participante = sala.participante(jogador.id);
      return {
        ...jogador,
        apelido: participante?.apelido ?? '—',
        ehBot: participante?.ehBot ?? false,
        conectado: participante?.conectado ?? false,
      };
    }),
  };
}

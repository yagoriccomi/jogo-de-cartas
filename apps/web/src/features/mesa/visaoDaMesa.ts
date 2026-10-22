import type { EstadoPartidaVisivel, EstadoSala, JogadorVisivel } from '@fodinha/shared';
import { contagemVisivel } from './cenaDaVaza';
import { emOrdemDeJogo } from './ordemDeJogo';

/** O que a mesa precisa saber para decidir; nada de React, DOM ou relógio. */
export interface EntradaDaVisao {
  readonly jogo: EstadoPartidaVisivel;
  readonly sala: EstadoSala | null;
  readonly meuId: string;
  /** Instante local em que o estado chegou: a contagem parte dele, não do relógio do servidor. */
  readonly recebidoEm: number;
  /** Montinho que a cena da vaza ainda leva ao dono (`VistaDaCena.monteEmVoo`). */
  readonly monteEmVoo: string | null;
}

export type TipoDaSituacao =
  'aguardandoProximaRodada' | 'pausada' | 'fimDaRodada' | 'minhaVez' | 'vezDeOutro' | 'aguardando';

export interface Situacao {
  readonly tipo: TipoDaSituacao;
  readonly texto: string;
}

export interface PalpiteAnterior {
  readonly id: string;
  readonly nome: string;
  readonly palpite: number;
  readonly ehMao: boolean;
}

export interface DadosDoPalpite {
  /** Quem palpitou antes de mim nesta rodada, na ordem de jogo (a mão primeiro). */
  readonly anteriores: readonly PalpiteAnterior[];
  /** Quantos vivos ainda palpitam depois de mim. */
  readonly depoisDeVoce: number;
  /** Soma dos palpites já dados pelos vivos. */
  readonly soma: number;
  readonly palpitaram: number;
  readonly vivos: number;
  readonly souOPe: boolean;
  /** O número que o pé não pode dizer; é a projeção do servidor que decide quem o recebe. */
  readonly proibido: number | null;
}

export interface VisaoDaMesa {
  readonly eu: JogadorVisivel | undefined;
  readonly emRodada: boolean;
  readonly pausado: boolean;
  /** Quem está com a vez agora; `null` fora da rodada ou com a mesa pausada. */
  readonly idDaVez: string | null;
  readonly souDaVez: boolean;
  readonly estouEliminado: boolean;
  readonly aguardandoProximaRodada: boolean;
  readonly palpitando: boolean;
  readonly podeJogar: boolean;
  /** É a minha vez de agir (palpitar ou jogar): chama a atenção com a faixa "Sua vez!". */
  readonly devoAgir: boolean;
  /** Na fase de jogo, a mão fica apagada enquanto a vez é de outro. */
  readonly apagarMao: boolean;
  readonly rotularMaoEPe: boolean;
  /** Fim do prazo da vez em tempo local; `null` sem prazo, fora da rodada ou na pausa. */
  readonly prazoFinal: number | null;
  readonly situacao: Situacao;
  readonly ordemDeJogo: readonly JogadorVisivel[];
  readonly adversarios: readonly JogadorVisivel[];
  readonly vivosNaMesa: number;
  readonly palpite: DadosDoPalpite;
  /** Vaza em disputa (1 a cartasPorJogador); a da vez é a seguinte às já decididas. */
  readonly vazaAtual: number;
  /** Vazas que fiz à vista: a que ainda voa até o meu montinho só conta ao pousar. */
  readonly minhasFeitas: number;
  readonly nomeDe: (id: string | null) => string | null;
}

function estaEmRodada(jogo: EstadoPartidaVisivel): boolean {
  return jogo.fase === 'palpites' || jogo.fase === 'jogando';
}

/**
 * A única regra de "de quem é a vez": só há vez com a rodada correndo e a mesa solta. Na pausa
 * (votação de ausente, dono ou leitura das regras) prazos e bots congelam, então ninguém está
 * com a vez.
 */
export function idDaVezAtiva(jogo: EstadoPartidaVisivel): string | null {
  if (!estaEmRodada(jogo) || jogo.pausa !== null) return null;
  return jogo.idDaVez;
}

/** Soma dos palpites dos vivos: o eliminado não conta para fechar a rodada. */
export function somaDosPalpites(jogadores: readonly JogadorVisivel[]): number {
  return jogadores.reduce(
    (soma, jogador) => soma + (jogador.eliminado ? 0 : (jogador.palpite ?? 0)),
    0,
  );
}

function criarNomeDe(jogo: EstadoPartidaVisivel, meuId: string) {
  return (id: string | null): string | null => {
    if (id === null) return null;
    if (id === meuId) return 'Você';
    return jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador';
  };
}

interface EntradaDaSituacao {
  readonly jogo: EstadoPartidaVisivel;
  readonly aguardandoProximaRodada: boolean;
  readonly souDaVez: boolean;
  readonly idDaVez: string | null;
  readonly nomeDe: (id: string | null) => string | null;
}

function descreverSituacao(entrada: EntradaDaSituacao): Situacao {
  const { jogo, idDaVez } = entrada;
  if (entrada.aguardandoProximaRodada) {
    return { tipo: 'aguardandoProximaRodada', texto: 'Você entra na próxima rodada' };
  }
  if (jogo.pausa !== null) return { tipo: 'pausada', texto: 'Partida pausada' };
  if (jogo.fase === 'fim_de_rodada') return { tipo: 'fimDaRodada', texto: 'Fim da rodada' };
  const acao = jogo.fase === 'palpites' ? 'palpitar' : 'jogar';
  if (entrada.souDaVez) return { tipo: 'minhaVez', texto: `Sua vez de ${acao}` };
  if (idDaVez === null) return { tipo: 'aguardando', texto: 'Aguardando…' };
  // Só o primeiro nome: "Paula Tejano" inteiro espremeria o meu status na barra.
  const primeiroNome = entrada.nomeDe(idDaVez)?.split(' ')[0];
  return { tipo: 'vezDeOutro', texto: `Vez de ${primeiroNome} ${acao}` };
}

function dadosDoPalpite(
  jogo: EstadoPartidaVisivel,
  vivosEmOrdem: readonly JogadorVisivel[],
  meuId: string,
): DadosDoPalpite {
  const minhaPosicao = vivosEmOrdem.findIndex((j) => j.id === meuId);
  const anteriores = vivosEmOrdem
    .slice(0, Math.max(minhaPosicao, 0))
    .flatMap((j) =>
      j.palpite === null
        ? []
        : [{ id: j.id, nome: j.apelido, palpite: j.palpite, ehMao: j.id === jogo.idDoPrimeiro }],
    );
  return {
    anteriores,
    depoisDeVoce: minhaPosicao === -1 ? 0 : vivosEmOrdem.length - minhaPosicao - 1,
    soma: somaDosPalpites(vivosEmOrdem),
    palpitaram: vivosEmOrdem.filter((j) => j.palpite !== null).length,
    vivos: vivosEmOrdem.length,
    souOPe: jogo.idDoPe === meuId,
    proibido: jogo.palpiteProibido,
  };
}

/** Vazas já decididas na rodada (ganhas por alguém ou todas anuladas); a da vez é a seguinte. */
function vazaEmDisputa(jogo: EstadoPartidaVisivel): number {
  const decididas =
    jogo.jogadores.reduce((soma, j) => soma + j.vazasFeitas, 0) + jogo.vazasEmpatadas.length;
  return Math.min(decididas + 1, jogo.cartasPorJogador);
}

/** Tudo o que a mesa decide a partir do estado, num lugar só e testável. */
export function visaoDaMesa(entrada: EntradaDaVisao): VisaoDaMesa {
  const { jogo, sala, meuId, recebidoEm, monteEmVoo } = entrada;
  const eu = jogo.jogadores.find((j) => j.id === meuId);
  const participante = sala?.participantes.find((p) => p.id === meuId);
  // Sem assento na partida e sem dado da sala: só pode ser quem chegou no meio.
  const aguardandoProximaRodada = participante?.aguardandoProximaRodada ?? eu === undefined;
  const emRodada = estaEmRodada(jogo);
  const pausado = jogo.pausa !== null;
  const idDaVez = idDaVezAtiva(jogo);
  const souDaVez = idDaVez !== null && idDaVez === meuId;
  const estouEliminado = eu?.eliminado ?? false;
  const devoAgir = souDaVez && !estouEliminado;
  const nomeDe = criarNomeDe(jogo, meuId);
  // Placas na ordem de jogo: a mão fica à esquerda e o pé à direita.
  const ordemDeJogo = emOrdemDeJogo(jogo.jogadores, jogo.idDoPrimeiro, jogo.idDoPe);
  const vivosEmOrdem = ordemDeJogo.filter((j) => !j.eliminado);

  return {
    eu,
    emRodada,
    pausado,
    idDaVez,
    souDaVez,
    estouEliminado,
    aguardandoProximaRodada,
    palpitando: devoAgir && jogo.fase === 'palpites',
    podeJogar: devoAgir && jogo.fase === 'jogando',
    devoAgir,
    apagarMao: jogo.fase === 'jogando' && !souDaVez,
    // Primeiro palpite da partida: mão e pé aparecem com o nome, depois só o ícone.
    rotularMaoEPe: jogo.numeroRodada === 1 && jogo.fase === 'palpites',
    // Contagem a partir do "tempo restante" que o servidor mandou, não do relógio dele.
    prazoFinal:
      idDaVez !== null && jogo.prazoDaVezRestanteMs !== null
        ? recebidoEm + jogo.prazoDaVezRestanteMs
        : null,
    situacao: descreverSituacao({ jogo, aguardandoProximaRodada, souDaVez, idDaVez, nomeDe }),
    ordemDeJogo,
    adversarios: ordemDeJogo.filter((j) => j.id !== meuId),
    vivosNaMesa: vivosEmOrdem.length,
    palpite: dadosDoPalpite(jogo, vivosEmOrdem, meuId),
    vazaAtual: vazaEmDisputa(jogo),
    minhasFeitas: contagemVisivel(monteEmVoo, meuId, eu?.vazasFeitas ?? 0),
    nomeDe,
  };
}

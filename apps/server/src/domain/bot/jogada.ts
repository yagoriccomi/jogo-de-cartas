import type { Carta, Jogada } from '@fodinha/shared';
import type { JogadorNaVisao, VisaoDaPartida } from '../projecao';
import { resolverVaza } from '../vaza';
import {
  cartasConhecidas,
  chanceDeSegurar,
  faltamPara,
  forca,
  lerVaza,
  ordenarPorForca,
  type Contexto,
  type LeituraDaVaza,
} from './leitura-da-mesa';
import type { AjustesDoPerfil } from './perfis';

// Com uma carta assim o bot leva a vaza já, sem esperar posição melhor.
const CHANCE_DE_VAZA_CERTA = 0.9;
// Na sabotagem, desempata os alvos de mesma vida a favor de quem está para acertar.
const PESO_DE_QUEM_ESTA_PARA_ACERTAR = 0.5;

interface Situacao {
  readonly visao: VisaoDaPartida;
  readonly jogadorId: string;
  readonly contexto: Contexto;
  readonly cartas: readonly Carta[];
  readonly vaza: LeituraDaVaza;
  readonly perfil: AjustesDoPerfil;
}

/** O que o bot sabe na hora de jogar. */
export interface Vez {
  readonly visao: VisaoDaPartida;
  readonly jogadorId: string;
  readonly mao: readonly Carta[];
  readonly contexto: Contexto;
}

/** Escolhe a carta para jogar fora da rodada cega (`answers/2026_10_22 bot-situacoes 001.md`). */
export function escolherJogada(
  { visao, jogadorId, mao, contexto }: Vez,
  perfil: AjustesDoPerfil,
): Carta {
  const cartas = ordenarPorForca(mao, contexto);
  const situacao: Situacao = {
    visao,
    jogadorId,
    contexto,
    cartas,
    vaza: lerVaza(visao, jogadorId, contexto),
    perfil,
  };
  const eu = visao.jogadores.find((jogador) => jogador.id === jogadorId);
  const faltam = eu ? faltamPara(eu) : 0;

  // Cumpriu ou estourou o palpite: cada vaza a mais custa uma vida.
  if (faltam <= 0) return cartaParaNaoGanhar(situacao, { guardarFortes: false });
  if (visao.mesa.length === 0) return abrirVaza(cartas, faltam, perfil);
  return cartaParaGanhar(situacao, faltam);
}

function abrirVaza(cartas: readonly Carta[], faltam: number, perfil: AjustesDoPerfil): Carta {
  // Precisa de todas as vazas que restam (ou mais): usa a melhor antes que algo a anule.
  if (faltam >= cartas.length || perfil.abreComAMaisForte)
    return cartas[cartas.length - 1] as Carta;
  // Sobra carta: abre com a do meio, guardando a mais forte para vaza em que ela decida.
  return cartas[Math.floor(cartas.length / 2)] as Carta;
}

function venceriaAgora(carta: Carta, situacao: Situacao): boolean {
  return vencedorCom(carta, situacao) === situacao.jogadorId;
}

function vencedorCom(carta: Carta, situacao: Situacao): string | null {
  const jogadas: Jogada[] = [...situacao.visao.mesa, { jogadorId: situacao.jogadorId, carta }];
  return resolverVaza(jogadas, situacao.contexto.manilha, situacao.contexto.valores);
}

// ---------------------------------------------------------------------------------------------
// Quando quer a vaza
// ---------------------------------------------------------------------------------------------

function cartaParaGanhar(situacao: Situacao, faltam: number): Carta {
  const { cartas, vaza, visao, contexto, perfil } = situacao;
  const vencedoras = cartas.filter((carta) => venceriaAgora(carta, situacao));
  // Esta não dá: perde barato, guardando as fortes para as próximas.
  if (vencedoras.length === 0) return cartaParaNaoGanhar(situacao, { guardarFortes: true });
  // Último da vaza: a menor que ganha basta, ninguém mais pode mudar o resultado.
  if (vaza.porJogar.length === 0) return vencedoras[0] as Carta;

  const conhecidas = cartasConhecidas(visao, cartas, contexto);
  const cartasDosQueFaltam = vaza.porJogar.reduce((soma, j) => soma + j.cartasNaMao, 0);
  const chance = (carta: Carta) => chanceDeSegurar(carta, conhecidas, cartasDosQueFaltam, contexto);
  const temVazaCerta = vencedoras.some((carta) => chance(carta) >= CHANCE_DE_VAZA_CERTA);
  if (!temVazaCerta && deveEsperarAPosicao(situacao, faltam)) {
    return cartaParaNaoGanhar(situacao, { guardarFortes: true });
  }
  return (
    vencedoras.find((carta) => chance(carta) >= perfil.chanceMinimaDeSegurar) ??
    (vencedoras[vencedoras.length - 1] as Carta)
  );
}

/**
 * A melhor posição é ser o último da vaza. Se quem joga logo depois também precisa de vaza e o
 * bot tem folga, ele deixa essa pessoa fazer a dela: ela abre a próxima e o bot fecha.
 */
function deveEsperarAPosicao(situacao: Situacao, faltam: number): boolean {
  if (!situacao.perfil.esperaAPosicao) return false;
  const proximo = situacao.vaza.porJogar[0];
  const temFolga = faltam < situacao.cartas.length;
  return temFolga && proximo !== undefined && faltamPara(proximo) > 0;
}

// ---------------------------------------------------------------------------------------------
// Quando não quer a vaza: a escada de decisão
// ---------------------------------------------------------------------------------------------

/**
 * Degraus, do melhor para o pior. Os de cima nunca ganham a vaza, haja o que houver depois.
 * 1-2. Igualar uma força já anulada na mesa (a maior primeiro): carta morta.
 * 3.   Anular a carta que está ganhando.
 * 4.   Carta segura: mais cartas valendo acima dela do que jogadores por vir (cada um só anula
 *      uma). Também conta igualar qualquer outra carta valendo: fica morta do mesmo jeito.
 * 5-6. Arriscadas, da mais protegida (abaixo de todas) para a menos (só abaixo da líder).
 * 7-8. Todas ganham agora: a menor, torcendo para alguém passar; sendo o último, a maior,
 *      porque a vaza era inevitável e as fracas ficam para fugir depois.
 */
const Degrau = {
  Ganha: 0,
  Arriscada: 1,
  Segura: 2,
  AnulaLider: 3,
  IgualaAnulada: 4,
} as const;
type Degrau = (typeof Degrau)[keyof typeof Degrau];

interface Opcao {
  readonly carta: Carta;
  readonly nivel: number;
  readonly degrau: Degrau;
  /** Cartas valendo acima dela (só importa nas arriscadas). */
  readonly protecao: number;
}

function avaliar(carta: Carta, situacao: Situacao): Opcao {
  const { vaza, contexto } = situacao;
  const nivel = forca(carta, contexto);
  const naMesa = vaza.contagem.get(nivel) ?? 0;
  const protecao = vaza.validas.filter((valida) => valida > nivel).length;
  const opcao = (degrau: Degrau): Opcao => ({ carta, nivel, degrau, protecao });

  if (naMesa >= 2) return opcao(Degrau.IgualaAnulada);
  if (naMesa === 1 && nivel === vaza.validas[0]) return opcao(Degrau.AnulaLider);
  if (naMesa === 1 || protecao > vaza.porJogar.length) return opcao(Degrau.Segura);
  if (protecao > 0) return opcao(Degrau.Arriscada);
  return opcao(Degrau.Ganha);
}

interface Preferencia {
  /** Ainda vai precisar de vaza nesta rodada: entre opções equivalentes, gasta a mais fraca. */
  readonly guardarFortes: boolean;
}

function cartaParaNaoGanhar(situacao: Situacao, { guardarFortes }: Preferencia): Carta {
  const opcoes = situacao.cartas.map((carta) => avaliar(carta, situacao));
  const souOUltimo = situacao.vaza.porJogar.length === 0;
  const { sabotagem } = situacao.perfil;
  const estrago = new Map(opcoes.map((opcao) => [opcao, estragoCom(opcao, situacao)]));
  const maisEstrago = (a: Opcao, b: Opcao) => (estrago.get(b) ?? 0) - (estrago.get(a) ?? 0);

  const melhor = [...opcoes].sort((a, b) => {
    // O sabotador troca a garantia de não levar a vaza pelo estrago, mas nunca a entrega a si já.
    if (sabotagem === 'arriscando' && a.degrau !== Degrau.Ganha && b.degrau !== Degrau.Ganha) {
      const diferenca = maisEstrago(a, b);
      if (diferenca !== 0) return diferenca;
    }
    const garantidaA = a.degrau >= Degrau.Segura;
    const garantidaB = b.degrau >= Degrau.Segura;
    if (garantidaA !== garantidaB) return garantidaA ? -1 : 1;
    // Sem risco para si, o bot escolhe a que mais atrapalha os outros.
    if (garantidaA && sabotagem !== 'nunca') {
      const diferenca = maisEstrago(a, b);
      if (diferenca !== 0) return diferenca;
    }
    if (a.degrau !== b.degrau) return b.degrau - a.degrau;
    if (a.degrau === Degrau.Arriscada && a.protecao !== b.protecao) {
      return b.protecao - a.protecao;
    }
    return desempate(a, b, { guardarFortes, souOUltimo });
  })[0] as Opcao;
  return melhor.carta;
}

function desempate(
  a: Opcao,
  b: Opcao,
  { guardarFortes, souOUltimo }: Preferencia & { readonly souOUltimo: boolean },
): number {
  const maiorPrimeiro = b.nivel - a.nivel || b.carta.id.localeCompare(a.carta.id);
  if (a.degrau === Degrau.Ganha) return souOUltimo ? maiorPrimeiro : -maiorPrimeiro;
  return guardarFortes ? -maiorPrimeiro : maiorPrimeiro;
}

/**
 * Quanto a carta atrapalha quem levaria a vaza se ela acabasse agora. Dar vaza a quem já cumpriu
 * custa uma vida a ele; tirar de quem precisa também. O peso mira em quem tem mais vidas.
 */
function estragoCom(opcao: Opcao, situacao: Situacao): number {
  const vencedorId = vencedorCom(opcao.carta, situacao);
  if (vencedorId === null || vencedorId === situacao.jogadorId) return 0;
  const vencedor = situacao.visao.jogadores.find((jogador) => jogador.id === vencedorId);
  if (!vencedor) return 0;
  const peso = pesoDoAlvo(vencedor);
  return faltamPara(vencedor) > 0 ? -peso : peso;
}

function pesoDoAlvo(jogador: JogadorNaVisao): number {
  const paraAcertar = faltamPara(jogador) === 1 ? PESO_DE_QUEM_ESTA_PARA_ACERTAR : 0;
  return jogador.vidas + paraAcertar;
}

import { useLayoutEffect, useState, type RefObject } from 'react';
import type { EstadoPartidaVisivel, JogadorVisivel } from '@fodinha/shared';
import {
  MARCADORES,
  prefereMenosMovimento,
  seletor,
  TEMPOS_DA_ANIMACAO,
} from './animacao-compartilhada';
import { centroDe, criarVersoSolto } from './mesa-voos';

/** Limite visual: além disto a distribuição ficaria longa e pesada sem acrescentar nada. */
const MAXIMO_DE_VOOS_POR_JOGADOR = 10;
/** Ao montar a tela no começo da partida (sem rodada anterior) ainda vale distribuir. */
const JANELA_DE_ABERTURA_MS = 2500;
const ESCALA_AO_CHEGAR = 0.55;
const FRACAO_ANTES_DE_SUMIR = 0.85;
/** Quanto as metades do monte se afastam ao embaralhar, em frações da largura da carta. */
const AFASTAMENTO_DO_CORTE = 0.7;
const INCLINACAO_DO_CORTE_GRAUS = 8;

/** Destino de cada carta distribuída, na ordem: id do adversário, ou `null` se for minha. */
type Entrega = readonly (string | null)[];

interface Entrada {
  readonly jogo: EstadoPartidaVisivel | null;
  readonly meuId: string | null;
  readonly recebidoEm: number;
  readonly vira: RefObject<HTMLElement>;
}

interface Estado {
  readonly rodada: number | null;
  readonly entrega: Entrega | null;
}

function planejarEntrega(jogo: EstadoPartidaVisivel, meuId: string | null): Entrega {
  const { jogadores } = jogo;
  const inicio = Math.max(
    jogadores.findIndex((jogador) => jogador.id === jogo.idDoPrimeiro),
    0,
  );
  const ordem: JogadorVisivel[] = [
    ...jogadores.slice(inicio),
    ...jogadores.slice(0, inicio),
  ].filter((jogador) => !jogador.eliminado && jogador.cartasNaMao > 0);
  const voltas = Math.min(
    Math.max(0, ...ordem.map((jogador) => jogador.cartasNaMao)),
    MAXIMO_DE_VOOS_POR_JOGADOR,
  );
  const entrega: (string | null)[] = [];
  for (let volta = 0; volta < voltas; volta += 1) {
    for (const jogador of ordem) {
      if (jogador.cartasNaMao > volta) entrega.push(jogador.id === meuId ? null : jogador.id);
    }
  }
  return entrega;
}

/** Partida recém-aberta (ninguém palpitou ainda): a mão e o baralho animam juntos a 1ª distribuição. */
export function aberturaDaPartida(jogo: EstadoPartidaVisivel, recebidoEm: number): boolean {
  return (
    jogo.fase === 'palpites' &&
    jogo.jogadores.every((jogador) => jogador.palpite === null) &&
    Date.now() - recebidoEm < JANELA_DE_ABERTURA_MS
  );
}

function embaralhar(baralho: HTMLElement): Animation[] {
  const cartas = Array.from(baralho.querySelectorAll<HTMLElement>('.baralho__carta'));
  const largura = baralho.getBoundingClientRect().width;
  return cartas.map((carta, indice) => {
    // Metade do monte vai para cada lado e volta cruzada: o "corte" do embaralhar.
    const lado = indice % 2 === 0 ? 1 : -1;
    const afastamento = lado * largura * AFASTAMENTO_DO_CORTE;
    const inclinacao = lado * INCLINACAO_DO_CORTE_GRAUS;
    return carta.animate(
      [
        { transform: 'none', offset: 0 },
        { transform: `translateX(${afastamento}px) rotate(${inclinacao}deg)`, offset: 0.35 },
        {
          transform: `translateX(${afastamento * 0.2}px) rotate(${-inclinacao / 2}deg)`,
          offset: 0.7,
        },
        { transform: 'none', offset: 1 },
      ],
      { duration: TEMPOS_DA_ANIMACAO.embaralharMs, easing: 'ease-in-out' },
    );
  });
}

function distribuir(baralho: DOMRect, entrega: Entrega, clones: HTMLElement[]): Animation[] {
  const animacoes: Animation[] = [];
  entrega.forEach((jogadorId, posicao) => {
    // As minhas cartas são animadas pela mão; aqui só ocupam o seu turno no ritmo da mesa.
    if (jogadorId === null) return;
    const placa = document.querySelector<HTMLElement>(
      seletor(MARCADORES.placaDoJogador, jogadorId),
    );
    const clone = criarVersoSolto(baralho);
    if (!placa || !clone) {
      clone?.remove();
      return;
    }
    clones.push(clone);
    // Oculto até a vez dele; o keyframe inicial (opacity 1) o revela quando o voo começa.
    clone.style.opacity = '0';
    const de = centroDe(baralho);
    const para = centroDe(placa.getBoundingClientRect());
    const alvo = `translate(${para.x - de.x}px, ${para.y - de.y}px) scale(${ESCALA_AO_CHEGAR})`;
    const animacao = clone.animate(
      [
        { transform: 'none', opacity: 1, offset: 0 },
        { transform: alvo, opacity: 1, offset: FRACAO_ANTES_DE_SUMIR },
        { transform: alvo, opacity: 0, offset: 1 },
      ],
      {
        duration: TEMPOS_DA_ANIMACAO.vooDaCartaMs,
        delay: posicao * TEMPOS_DA_ANIMACAO.intervaloDaDistribuicaoMs,
        easing: 'ease-in-out',
        fill: 'forwards',
      },
    );
    animacoes.push(animacao);
  });
  return animacoes;
}

function revelarVira(vira: HTMLElement, baralho: DOMRect): void {
  vira.style.opacity = '';
  const de = centroDe(baralho);
  const para = centroDe(vira.getBoundingClientRect());
  vira.animate(
    [
      { transform: `translate(${de.x - para.x}px, ${de.y - para.y}px) scaleX(0)`, opacity: 1 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: TEMPOS_DA_ANIMACAO.vooDaCartaMs, easing: 'ease-out' },
  );
}

/** Executa embaralhar → distribuir → virar a vira; devolve a função que cancela tudo. */
function iniciarEntrega(baralhoEl: HTMLElement, vira: HTMLElement, entrega: Entrega): () => void {
  const clones: HTMLElement[] = [];
  const animacoes: Animation[] = [];
  const cancelamentos: (() => void)[] = [];
  let cancelado = false;
  // A vira some até ser "virada" do baralho; ocultar aqui (antes da pintura) evita um lampejo.
  vira.style.opacity = '0';

  const corte = embaralhar(baralhoEl);
  animacoes.push(...corte);

  void Promise.all(corte.map((animacao) => animacao.finished))
    .then(() => {
      if (cancelado) return undefined;
      const retangulo = baralhoEl.getBoundingClientRect();
      const voos = distribuir(retangulo, entrega, clones);
      animacoes.push(...voos);
      const intervalo = TEMPOS_DA_ANIMACAO.intervaloDaDistribuicaoMs;
      const faltaParaVira =
        Math.max(0, entrega.length - 1) * intervalo + TEMPOS_DA_ANIMACAO.vooDaCartaMs;
      return new Promise<DOMRect>((resolver) => {
        const temporizador = setTimeout(() => resolver(retangulo), faltaParaVira);
        cancelamentos.push(() => clearTimeout(temporizador));
      });
    })
    .then((retangulo) => {
      if (cancelado || !retangulo) return;
      revelarVira(vira, retangulo);
      clones.forEach((clone) => clone.remove());
    })
    // Cancelar rejeita `finished`; é o caminho normal de desmontagem.
    .catch(() => undefined);

  return () => {
    cancelado = true;
    animacoes.forEach((animacao) => animacao.cancel());
    cancelamentos.forEach((cancelar) => cancelar());
    clones.forEach((clone) => clone.remove());
    vira.style.opacity = '';
  };
}

/**
 * Anima a distribuição quando `numeroRodada` muda (e na abertura da partida): o monte embaralha,
 * as cartas voam do baralho até a placa de cada adversário e por fim a vira "vira". A mão do
 * jogador é animada por `Mao.tsx`, no mesmo ritmo (`TEMPOS_DA_ANIMACAO`).
 */
export function useBaralho({ jogo, meuId, recebidoEm, vira }: Entrada): void {
  const numeroRodada = jogo?.numeroRodada ?? null;
  const [estado, definirEstado] = useState<Estado>({ rodada: null, entrega: null });

  // Ajuste durante a renderização: o plano nasce no mesmo render em que o estado novo chega.
  if (jogo !== null && estado.rodada !== numeroRodada) {
    const primeiraVez = estado.rodada === null;
    const deveAnimar =
      !prefereMenosMovimento() && (primeiraVez ? aberturaDaPartida(jogo, recebidoEm) : true);
    definirEstado({
      rodada: numeroRodada,
      entrega: deveAnimar ? planejarEntrega(jogo, meuId) : null,
    });
  }

  const entrega = estado.entrega;
  useLayoutEffect(() => {
    if (entrega === null) return;
    const baralho = document.querySelector<HTMLElement>(seletor(MARCADORES.baralho));
    const viraEl = vira.current;
    if (!baralho || !viraEl) return;
    return iniciarEntrega(baralho, viraEl, entrega);
  }, [entrega, vira]);
}

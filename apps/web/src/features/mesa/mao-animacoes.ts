import { MARCADORES, TEMPOS_DA_ANIMACAO, seletor } from './animacao-compartilhada';
import type { LayoutDoLeque, PosicaoNoLeque } from './leque';
import type { VooDaCarta } from './planoDaMao';

/** Verso desenhado por cima da face enquanto a carta ainda não foi "desvirada". */
export const SELETOR_VERSO = '.mao__verso';

/** Trecho do voo (0 a 1) em que a carta termina de virar; o resto é o pouso. */
const FIM_DO_VERSO_NO_VOO = 0.8;
const INICIO_DO_VERSO_NO_VOO = 0.65;
const ESCALA_DO_VOO = 0.85;
const EASING_DO_VOO = 'cubic-bezier(0.2, 0.8, 0.25, 1)';
/** Primeiro instante em que a carta aparece: antes disso ela espera invisível no baralho. */
const OFFSET_DE_APARECER = 0.001;

export interface AnimacaoEmCurso {
  /** `true` só se a animação foi até o fim; `false` se foi cancelada. */
  readonly terminou: Promise<boolean>;
  cancelar: () => void;
}

interface EntradaDaDistribuicao {
  /** Um `li` por carta, na ordem recebida do servidor. */
  readonly itens: readonly HTMLElement[];
  /** Plano de cada carta (`planejarDistribuicao`), na mesma ordem dos itens. */
  readonly voos: readonly VooDaCarta[];
  readonly leque: HTMLElement;
  readonly layout: LayoutDoLeque;
}

function transformar(posicao: PosicaoNoLeque, dx: number, dy: number, escala = 1): string {
  return `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) translateY(${posicao.deslocamentoY.toFixed(1)}px) rotate(${posicao.rotacao.toFixed(1)}deg) scale(${escala})`;
}

/**
 * Executa o plano da distribuição: as cartas voam viradas do baralho até os lugares do plano
 * (desvirando ao pousar) e, quando todas chegam, a mão se organiza na ordem do servidor. As
 * posições finais já estão no DOM; aqui só se anima a diferença (FLIP).
 */
export function animarDistribuicao(entrada: EntradaDaDistribuicao): AnimacaoEmCurso {
  const { itens, voos: plano, leque, layout } = entrada;
  const { posicoes, larguraCarta, alturaCarta } = layout;
  const todas: Animation[] = [];
  const cancelar = () => todas.forEach((a) => a.cancel());

  const caixa = leque.getBoundingClientRect();
  const baralho = document.querySelector(seletor(MARCADORES.baralho));
  const caixaDoBaralho = baralho?.getBoundingClientRect();
  const origem = caixaDoBaralho
    ? {
        x: caixaDoBaralho.left + caixaDoBaralho.width / 2,
        y: caixaDoBaralho.top + caixaDoBaralho.height / 2,
      }
    : { x: window.innerWidth / 2, y: -alturaCarta };

  const pouso: { animacao: Animation; item: HTMLElement; deLanding: string; base: string }[] = [];
  const voos: Animation[] = [];

  itens.forEach((item, indice) => {
    const posicao = posicoes[indice];
    const planoDoVoo = plano[indice];
    const alvo = planoDoVoo && posicoes[planoDoVoo.lugar];
    if (!posicao || !planoDoVoo || !alvo) return;

    const centroX = caixa.left + posicao.esquerda + larguraCarta / 2;
    const centroY = caixa.top + posicao.topo + alturaCarta / 2;
    const saida = transformar(posicao, origem.x - centroX, origem.y - centroY, ESCALA_DO_VOO);
    const chegada = transformar(alvo, alvo.esquerda - posicao.esquerda, alvo.topo - posicao.topo);
    const opcoes: KeyframeAnimationOptions = {
      duration: TEMPOS_DA_ANIMACAO.vooDaCartaMs,
      delay: planoDoVoo.atrasoMs,
      fill: 'both',
    };

    const voo = item.animate(
      [
        { transform: saida, opacity: 0, offset: 0 },
        { transform: saida, opacity: 1, offset: OFFSET_DE_APARECER, easing: EASING_DO_VOO },
        { transform: chegada, opacity: 1, offset: 1 },
      ],
      opcoes,
    );
    todas.push(voo);
    voos.push(voo);
    pouso.push({
      animacao: voo,
      item,
      deLanding: chegada,
      base: transformar(posicao, 0, 0),
    });

    const frente = item.firstElementChild;
    const verso = item.querySelector(SELETOR_VERSO);
    if (
      !planoDoVoo.desvira ||
      !(frente instanceof HTMLElement) ||
      !(verso instanceof HTMLElement)
    ) {
      return;
    }
    todas.push(
      verso.animate(
        [
          { transform: 'scaleX(1)', offset: 0 },
          { transform: 'scaleX(1)', offset: INICIO_DO_VERSO_NO_VOO },
          { transform: 'scaleX(0)', offset: FIM_DO_VERSO_NO_VOO },
          { transform: 'scaleX(0)', offset: 1 },
        ],
        opcoes,
      ),
      frente.animate(
        [
          { transform: 'scaleX(0)', offset: 0 },
          { transform: 'scaleX(0)', offset: FIM_DO_VERSO_NO_VOO },
          { transform: 'scaleX(1)', offset: 1 },
        ],
        opcoes,
      ),
    );
  });

  const terminou = Promise.all(voos.map((voo) => voo.finished)).then(
    async () => {
      const organizar = pouso.map(({ item, deLanding, base }) =>
        item.animate([{ transform: deLanding }, { transform: base }], {
          duration: TEMPOS_DA_ANIMACAO.organizarMaoMs,
          easing: 'ease-in-out',
          fill: 'both',
        }),
      );
      todas.push(...organizar);
      await Promise.all(organizar.map((a) => a.finished));
      return true;
    },
    () => false,
  );
  // A segunda etapa também pode ser cancelada no meio: vira `false` em vez de erro solto.
  return { terminou: terminou.catch(() => false), cancelar };
}

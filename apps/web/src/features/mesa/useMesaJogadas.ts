import { useLayoutEffect, useRef, type RefObject } from 'react';
import type { JogadaNaMesa } from '@fodinha/shared';
import {
  MARCADORES,
  prefereMenosMovimento,
  retirarOrigemDaJogada,
  TEMPOS_DA_ANIMACAO,
} from './animacao-compartilhada';
import { origemNaMao, origemNaPlaca, reacomodar, voarAteAMesa } from './mesa-voos';

interface Entrada {
  /** Cartas exibidas nas linhas (a mesa, ou a vaza fechada enquanto ela é mostrada). */
  readonly cartas: readonly JogadaNaMesa[];
  readonly meuId: string | null;
  /** Rodada cega: a minha carta também sai virada, pois só é revelada na mesa. */
  readonly rodadaCega: boolean;
  readonly raiz: RefObject<HTMLElement | null>;
}

function assinaturaDe(cartas: readonly JogadaNaMesa[]): string {
  return cartas.map((jogada) => `${jogada.carta.id}:${jogada.anulada ? 1 : 0}`).join(',');
}

/**
 * Anima o que muda nas linhas da mesa: carta nova (voa da placa do adversário ou da minha mão,
 * desvirando quando vem de outro lugar) e carta que muda de linha/posição (FLIP). A primeira
 * leitura só memoriza as posições, para abrir ou reconectar no meio da vaza sem animar.
 */
export function useMesaJogadas({ cartas, meuId, rodadaCega, raiz }: Entrada): void {
  const posicoes = useRef<Map<string, DOMRect> | null>(null);
  const ultimaAssinatura = useRef<string | null>(null);

  useLayoutEffect(() => {
    const assinatura = assinaturaDe(cartas);
    if (assinatura === ultimaAssinatura.current) return;
    ultimaAssinatura.current = assinatura;

    const elementos = Array.from(
      raiz.current?.querySelectorAll<HTMLElement>(`[${MARCADORES.cartaNaMesa}]`) ?? [],
    );
    const agora = new Map<string, DOMRect>();
    const anteriores = posicoes.current;
    const animar = anteriores !== null && !prefereMenosMovimento();
    let novasNoLote = 0;

    for (const elemento of elementos) {
      const id = elemento.getAttribute(MARCADORES.cartaNaMesa);
      if (id === null) continue;
      const retangulo = elemento.getBoundingClientRect();
      agora.set(id, retangulo);

      const anterior = anteriores?.get(id);
      const jogada = cartas.find((item) => item.carta.id === id);
      const souEu = jogada !== undefined && jogada.jogadorId === meuId;
      // A origem registrada pela mão precisa ser consumida mesmo sem animar, senão vaza memória.
      const origemRegistrada = souEu ? retirarOrigemDaJogada(id) : undefined;
      if (!animar || !jogada) continue;

      if (anterior !== undefined) {
        reacomodar(elemento, anterior, retangulo);
        continue;
      }

      const origem = souEu
        ? (origemRegistrada ?? origemNaMao(retangulo))
        : origemNaPlaca(jogada.jogadorId, retangulo);
      if (!origem) continue;
      voarAteAMesa(elemento, {
        origem,
        atrasoMs: novasNoLote * TEMPOS_DA_ANIMACAO.escalonamentoDaRevelacaoMs,
        desvirar: !souEu || rodadaCega,
      });
      novasNoLote += 1;
    }
    posicoes.current = agora;
  }, [cartas, meuId, rodadaCega, raiz]);
}

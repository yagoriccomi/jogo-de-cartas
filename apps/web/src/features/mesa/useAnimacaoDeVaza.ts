import { useEffect, useRef, useState, type RefObject } from 'react';
import type { FasePartida, VazaResolvida } from '@fodinha/shared';
import { prefereMenosMovimento } from './animacao-compartilhada';
import {
  abrirCena,
  cenaAtiva,
  chaveDaVaza,
  destinoDaVaza,
  esperaAntesDoVooMs,
  levantarVoo,
  TEMPOS_DA_CENA,
  vistaDaCena,
  type Cena,
  type VistaDaCena,
} from './cenaDaVaza';
import { buscarDestinoDoMonte, cartasDaMesa, voarVazaAoMonte } from './mesa-voos';

interface Entrada {
  readonly ultimaVaza: VazaResolvida | null;
  readonly mesaVazia: boolean;
  readonly rodadaCega: boolean;
  /** `null` antes de o estado do jogo chegar. */
  readonly fase: FasePartida | null;
}

export interface AnimacaoDeVaza extends VistaDaCena {
  /** Contêiner das duas linhas, que contém as cartas da mesa a animar. */
  readonly raiz: RefObject<HTMLDivElement | null>;
}

/**
 * Animação da vaza fechada (FLIP, sem biblioteca): a linha do tempo vem de `cenaDaVaza` e o voo,
 * de `mesa-voos`; aqui só se agendam as fases. Detecta a vaza nova pela chave das cartas; a
 * primeira vaza vista ao montar a tela (reconexão) não anima.
 */
export function useAnimacaoDeVaza({
  ultimaVaza,
  mesaVazia,
  rodadaCega,
  fase,
}: Entrada): AnimacaoDeVaza {
  const chave = chaveDaVaza(ultimaVaza);
  const [chaveVista, definirChaveVista] = useState(chave);
  const [cena, definirCena] = useState<Cena | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  // Ajuste durante a renderização: a cena nasce no mesmo render em que o estado novo chega,
  // então o montinho de destino nunca aparece antes da hora.
  if (chave !== chaveVista) {
    definirChaveVista(chave);
    definirCena(
      abrirCena({
        vaza: ultimaVaza,
        mesaVazia,
        rodadaCega,
        fimDeRodada: fase === 'fim_de_rodada' || fase === 'encerrada',
        menosMovimento: prefereMenosMovimento(),
      }),
    );
  }

  const ativa = cenaAtiva(cena, mesaVazia);

  useEffect(() => {
    if (ativa?.fase !== 'espera') return;
    const temporizador = setTimeout(
      () => definirCena((atual) => (atual ? levantarVoo(atual) : atual)),
      esperaAntesDoVooMs(ativa),
    );
    return () => clearTimeout(temporizador);
    // A cena só muda de objeto quando muda de fase ou de vaza; o resto vem dela.
  }, [ativa]);

  useEffect(() => {
    if (ativa?.fase !== 'voo') return;
    const encerrar = () => definirCena(null);
    const { vaza } = ativa;
    const animacoes = voarVazaAoMonte({
      cartas: cartasDaMesa(raiz.current),
      cartaVencedoraId:
        vaza.jogadas.find((jogada) => jogada.jogadorId === vaza.vencedorId)?.carta.id ?? null,
      destino: buscarDestinoDoMonte(destinoDaVaza(vaza)),
      duracaoMs: TEMPOS_DA_CENA.vooAoMonteMs,
    });
    if (animacoes === null) {
      encerrar();
      return;
    }
    // Cancelamento (nova vaza ou desmontagem) rejeita `finished`; nesse caso não há o que encerrar.
    void Promise.all(animacoes.map((animacao) => animacao.finished)).then(
      encerrar,
      () => undefined,
    );
    return () => animacoes.forEach((animacao) => animacao.cancel());
  }, [ativa]);

  return { ...vistaDaCena(ativa, fase), raiz };
}

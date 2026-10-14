import { useEffect, useMemo, useState } from 'react';
import type { CartaNaMao, Valor } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { CONSULTA_COMPUTADOR, CONSULTA_TOQUE, useMediaQuery } from '../../lib/useMediaQuery';
import { useLargura } from '../../lib/useLargura';
import { Carta } from './Carta';
import { calcularLeque } from './leque';

interface Props {
  /** Já chega ordenada do servidor (mais forte → mais fraca): nunca reordenar aqui. */
  readonly cartas: readonly CartaNaMao[];
  readonly manilha: Valor | null;
  /** Só `true` na minha vez e na fase de jogar; fora disso as cartas ficam inertes. */
  readonly podeJogar: boolean;
  /** Apaga as cartas quando não é a minha vez de jogar (na fase de palpites elas ficam nítidas). */
  readonly apagar: boolean;
  readonly onJogar: (cartaId: string) => void;
}

export function Mao({ cartas, manilha, podeJogar, apagar, onJogar }: Props) {
  const computador = useMediaQuery(CONSULTA_COMPUTADOR);
  const toque = useMediaQuery(CONSULTA_TOQUE);
  const [referencia, largura] = useLargura<HTMLDivElement>();
  const [selecionadaId, definirSelecionadaId] = useState<string | null>(null);

  const layout = useMemo(
    () => calcularLeque({ quantidade: cartas.length, larguraDisponivel: largura, computador }),
    [cartas.length, largura, computador],
  );

  // A seleção só faz sentido enquanto a carta existe e é a minha vez de jogar.
  useEffect(() => {
    if (selecionadaId === null) return;
    const aindaNaMao = cartas.some((carta) => carta.id === selecionadaId);
    if (!podeJogar || !aindaNaMao) definirSelecionadaId(null);
  }, [cartas, podeJogar, selecionadaId]);

  if (cartas.length === 0) return null;

  function aoEscolher(cartaId: string) {
    if (!podeJogar) return;
    if (!toque) {
      onJogar(cartaId);
      return;
    }
    // Em telas de toque, o primeiro toque só escolhe: evita jogar a carta errada sem querer.
    if (selecionadaId === cartaId) {
      definirSelecionadaId(null);
      onJogar(cartaId);
      return;
    }
    definirSelecionadaId(cartaId);
  }

  const dica =
    podeJogar && toque
      ? 'Toque para escolher, toque de novo para jogar'
      : `Sua mão · ${cartas.length} ${cartas.length === 1 ? 'carta' : 'cartas'}`;

  return (
    <div className="mao" ref={referencia}>
      <div className="mao__legenda">
        <span className="mao__forte">◀ Mais forte</span>
        <span className="mao__dica" aria-live="polite">
          {dica}
        </span>
        <span className="mao__fraca">Mais fraca ▶</span>
      </div>
      <ul
        className="mao__leque"
        aria-label="Sua mão"
        style={{ width: layout.larguraTotal, height: layout.alturaTotal }}
      >
        {cartas.map((carta, indice) => {
          const posicao = layout.posicoes[indice];
          if (!posicao) return null;
          const selecionada = selecionadaId === carta.id;
          const estilo: EstiloComVariaveis = {
            left: posicao.esquerda,
            top: posicao.topo,
            width: layout.larguraCarta,
            transform: `translateY(${posicao.deslocamentoY.toFixed(1)}px) rotate(${posicao.rotacao.toFixed(1)}deg)`,
          };
          return (
            <li
              key={carta.id}
              className={classes('mao__posicao', selecionada && 'mao__posicao--selecionada')}
              style={estilo}
            >
              <Carta
                carta={carta}
                manilha={manilha}
                largura={layout.larguraCarta}
                densa={layout.densa}
                estado={selecionada ? 'selecionada' : apagar ? 'apagada' : 'normal'}
                pressionada={podeJogar && toque ? selecionada : undefined}
                onClick={podeJogar ? () => aoEscolher(carta.id) : undefined}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

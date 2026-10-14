import type { JogadaNaMesa, Valor } from '@fodinha/shared';
import type { RefObject } from 'react';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { MARCADORES } from './animacao-compartilhada';
import { Carta } from './Carta';

interface Props {
  readonly cartas: readonly JogadaNaMesa[];
  readonly manilha: Valor | null;
  readonly nomeDe: (jogadorId: string) => string;
  readonly voando: boolean;
  readonly raiz: RefObject<HTMLDivElement>;
}

interface LinhaProps {
  readonly cartas: readonly JogadaNaMesa[];
  readonly manilha: Valor | null;
  readonly nomeDe: (jogadorId: string) => string;
  readonly anuladas: boolean;
}

/**
 * Fila já ordenada pelo servidor da mais forte para a mais fraca. Na linha que vale, a primeira
 * (a que está ganhando) fica sozinha, afastada; as demais formam uma pilha ao lado, cada uma por
 * cima da anterior, deixando à mostra o canto com o valor das mais fortes.
 */
function LinhaDeCartas({ cartas, manilha, nomeDe, anuladas }: LinhaProps) {
  const estilo: EstiloComVariaveis = { '--n': Math.max(cartas.length, 1) };
  return (
    <ul
      className={classes('mesa-linha', anuladas ? 'mesa-linha--anuladas' : 'mesa-linha--valendo')}
      style={estilo}
      aria-label={anuladas ? 'Cartas empatadas, anuladas' : 'Cartas valendo'}
      aria-hidden={cartas.length === 0 ? true : undefined}
    >
      {cartas.map((jogada, posicao) => {
        const nome = nomeDe(jogada.jogadorId);
        const lider = !anuladas && posicao === 0;
        return (
          <li
            key={jogada.carta.id}
            className={classes('mesa-linha__carta', lider && 'mesa-linha__carta--lider')}
            {...{ [MARCADORES.cartaNaMesa]: jogada.carta.id }}
            title={anuladas ? `${nome} (empatou)` : lider ? `${nome} (ganhando)` : nome}
          >
            <Carta carta={jogada.carta} manilha={manilha} rotulo={nome} />
          </li>
        );
      })}
    </ul>
  );
}

/** Duas linhas sem divisória: em cima o que vale, embaixo o que empatou e se anulou. */
export function MesaLinhas({ cartas, manilha, nomeDe, voando, raiz }: Props) {
  const valendo = cartas.filter((jogada) => !jogada.anulada);
  const anuladas = cartas.filter((jogada) => jogada.anulada);
  // A carta encolhe conforme a maior das filas (o CSS usa `--n-max` para caber na largura).
  const estilo: EstiloComVariaveis = { '--n-max': Math.max(valendo.length, anuladas.length, 1) };
  return (
    <div
      ref={raiz}
      className={classes('mesa-linhas', voando && 'mesa-linhas--voando')}
      style={estilo}
    >
      <LinhaDeCartas cartas={valendo} manilha={manilha} nomeDe={nomeDe} anuladas={false} />
      <LinhaDeCartas cartas={anuladas} manilha={manilha} nomeDe={nomeDe} anuladas />
    </div>
  );
}

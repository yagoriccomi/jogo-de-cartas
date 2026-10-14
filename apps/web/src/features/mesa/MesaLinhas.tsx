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
 * Fila de cartas sobrepostas, já ordenada pelo servidor da mais forte para a mais fraca: a mais
 * forte fica à esquerda e por cima de todas; cada seguinte entra por trás da anterior. O nome do
 * dono fica só no `title`/rótulo para não atrapalhar.
 */
function LinhaDeCartas({ cartas, manilha, nomeDe, anuladas }: LinhaProps) {
  const estilo: EstiloComVariaveis = { '--n': Math.max(cartas.length, 1) };
  return (
    <ul
      className={classes('mesa-linha', anuladas && 'mesa-linha--anuladas')}
      style={estilo}
      aria-label={anuladas ? 'Cartas empatadas, anuladas' : 'Cartas valendo'}
      aria-hidden={cartas.length === 0 ? true : undefined}
    >
      {cartas.map((jogada, posicao) => {
        const nome = nomeDe(jogada.jogadorId);
        const camada: EstiloComVariaveis = { '--camada': cartas.length - posicao };
        return (
          <li
            key={jogada.carta.id}
            className="mesa-linha__carta"
            style={camada}
            {...{ [MARCADORES.cartaNaMesa]: jogada.carta.id }}
            title={anuladas ? `${nome} (empatou)` : nome}
          >
            <Carta carta={jogada.carta} manilha={manilha} rotulo={nome} canto="direito" />
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

import type { Valor, VazaGanha } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { Carta } from './Carta';

/** Quantas "folhas" aparecem atrás da carta vencedora; mais que isso só poluiria a miniatura. */
const CAMADAS_MAXIMAS = 3;

interface Props {
  readonly jogadorId: string;
  readonly vazas: readonly VazaGanha[];
  readonly manilha: Valor | null;
  /** Esconde o montinho mais novo enquanto a animação ainda o leva até aqui. */
  readonly ocultarUltimo: boolean;
  readonly className?: string;
}

/**
 * Um montinho por vaza ganha na rodada, lado a lado: a carta vencedora por cima e folhas atrás
 * sugerindo quantas cartas vieram junto. O espaçamento é calculado no CSS a partir de `--n`, de
 * modo que muitas vazas se sobrepõem em vez de estourar a placa.
 */
export function Montinhos({ jogadorId, vazas, manilha, ocultarUltimo, className }: Props) {
  if (vazas.length === 0) return null;

  const estilo: EstiloComVariaveis = { '--n': vazas.length };
  return (
    <ul
      className={classes('montes', className)}
      style={estilo}
      aria-label={`Vazas ganhas: ${vazas.length}`}
    >
      {vazas.map((vaza, indice) => {
        const ehUltimo = indice === vazas.length - 1;
        const camadas = Math.min(Math.max(vaza.quantidadeDeCartas - 1, 0), CAMADAS_MAXIMAS);
        return (
          // O índice é estável: os montinhos só crescem no fim e são zerados a cada rodada.
          <li
            key={indice}
            className={classes('monte', ehUltimo && ocultarUltimo && 'monte--oculto')}
            data-monte-destino={ehUltimo ? jogadorId : undefined}
            title={`${vaza.quantidadeDeCartas} ${vaza.quantidadeDeCartas === 1 ? 'carta' : 'cartas'}`}
          >
            {Array.from({ length: camadas }, (_, camada) => {
              const estiloCamada: EstiloComVariaveis = { '--camada': camada + 1 };
              return (
                <span
                  key={camada}
                  className="monte__camada"
                  style={estiloCamada}
                  aria-hidden="true"
                />
              );
            })}
            <Carta
              carta={vaza.cartaVencedora}
              manilha={manilha}
              densa
              rotulo={`Vaza ${indice + 1}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

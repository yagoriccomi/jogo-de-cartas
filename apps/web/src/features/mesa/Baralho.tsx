import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { MARCADORES } from './animacao-compartilhada';
import { Carta } from './Carta';

/** Cartas empilhadas que o "embaralhar" separa e junta; mais que isso não se nota. */
const CARTAS_DO_MONTE = 4;

/** Monte de cartas viradas ao lado da vira: origem da distribuição (decorativo para leitores de tela). */
export function Baralho() {
  return (
    <div className="baralho" aria-hidden="true" {...{ [MARCADORES.baralho]: '' }}>
      {Array.from({ length: CARTAS_DO_MONTE }, (_, indice) => {
        const estilo: EstiloComVariaveis = { '--i': indice };
        return (
          <span key={indice} className="baralho__carta" style={estilo}>
            <Carta carta={null} />
          </span>
        );
      })}
    </div>
  );
}

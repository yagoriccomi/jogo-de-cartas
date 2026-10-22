import { classes } from '../../lib/classes';
import { ALVOS, marcarAlvo } from './alvos';
import { caminhoDoDesenho } from './pixel';

// Desenhos em pixel (mesma grade das cartas): "X" é pixel aceso.
const DESENHO_MAO: readonly string[] = [
  '..X.X.X..',
  '..X.X.X.X',
  '..X.X.X.X',
  'X.X.X.X.X',
  'XXXXXXXXX',
  '.XXXXXXXX',
  '.XXXXXXX.',
  '..XXXXXX.',
  '...XXXX..',
];

// Pegada (dedos em cima, sola embaixo): o sapato de antes não se lia como "pé".
const DESENHO_PE: readonly string[] = [
  '.XX.X.X.X',
  '.XX......',
  '.........',
  '..XXXXXX.',
  '.XXXXXXXX',
  '.XXXXXXX.',
  '..XXXXXX.',
  '..XXXXX..',
  '...XXX...',
];

const VIEWBOX = '0 0 9 9';

interface Props {
  /** Abre a rodada: é o primeiro a palpitar e a jogar (a "mão"). */
  readonly ehMao: boolean;
  /** Último a palpitar: não pode fechar a soma (o "pé"). */
  readonly ehPe: boolean;
  readonly className?: string;
  /** Escreve "MÃO"/"PÉ" ao lado do ícone (primeiro palpite da partida, para aprender o ícone). */
  readonly comRotulo?: boolean;
}

interface SimboloProps {
  readonly desenho: readonly string[];
  readonly nome: string;
  readonly tipo: string;
  readonly rotulo: string | null;
}

function Simbolo({ desenho, nome, tipo, rotulo }: SimboloProps) {
  return (
    <span
      className={classes(`simbolo simbolo--${tipo}`, rotulo !== null && 'simbolo--com-rotulo')}
      role="img"
      aria-label={nome}
      title={nome}
      {...(tipo === 'mao' && marcarAlvo(ALVOS.simboloDaMao))}
    >
      <svg viewBox={VIEWBOX} shapeRendering="crispEdges" aria-hidden="true">
        <path fill="currentColor" d={caminhoDoDesenho(desenho)} />
      </svg>
      {rotulo !== null && <span aria-hidden="true">{rotulo}</span>}
    </span>
  );
}

/** Símbolos de "mão" e "pé" no canto superior direito do status de um jogador. */
export function SimbolosMaoEPe({ ehMao, ehPe, className, comRotulo = false }: Props) {
  if (!ehMao && !ehPe) return null;
  return (
    <span
      className={classes('simbolos', comRotulo && 'simbolos--com-rotulo', className)}
      {...marcarAlvo(ALVOS.simbolos)}
    >
      {ehMao && (
        <Simbolo
          desenho={DESENHO_MAO}
          nome="Mão: abre a rodada"
          tipo="mao"
          rotulo={comRotulo ? 'Mão' : null}
        />
      )}
      {ehPe && (
        <Simbolo
          desenho={DESENHO_PE}
          nome="Pé: último a palpitar"
          tipo="pe"
          rotulo={comRotulo ? 'Pé' : null}
        />
      )}
    </span>
  );
}

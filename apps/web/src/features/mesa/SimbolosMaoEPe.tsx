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
}

interface SimboloProps {
  readonly desenho: readonly string[];
  readonly nome: string;
  readonly tipo: string;
}

function Simbolo({ desenho, nome, tipo }: SimboloProps) {
  return (
    <span
      className={`simbolo simbolo--${tipo}`}
      role="img"
      aria-label={nome}
      title={nome}
      {...(tipo === 'mao' && marcarAlvo(ALVOS.simboloDaMao))}
    >
      <svg viewBox={VIEWBOX} shapeRendering="crispEdges" aria-hidden="true">
        <path fill="currentColor" d={caminhoDoDesenho(desenho)} />
      </svg>
    </span>
  );
}

/** Símbolos de "mão" e "pé" no canto superior direito do status de um jogador. */
export function SimbolosMaoEPe({ ehMao, ehPe, className }: Props) {
  if (!ehMao && !ehPe) return null;
  return (
    <span className={classes('simbolos', className)} {...marcarAlvo(ALVOS.simbolos)}>
      {ehMao && <Simbolo desenho={DESENHO_MAO} nome="Mão: abre a rodada" tipo="mao" />}
      {ehPe && <Simbolo desenho={DESENHO_PE} nome="Pé: último a palpitar" tipo="pe" />}
    </span>
  );
}

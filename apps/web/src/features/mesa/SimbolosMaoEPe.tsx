import { classes } from '../../lib/classes';
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

const DESENHO_PE: readonly string[] = [
  '..XXX....',
  '..XXX....',
  '..XXX....',
  '..XXX....',
  '..XXXX...',
  '..XXXXXX.',
  '.XXXXXXXX',
  '.XXXXXXXX',
  '.XXXXXXX.',
];

const VIEWBOX = '0 0 9 9';

interface Props {
  /** Abre a rodada: é o primeiro a palpitar e a jogar (a "mão"). */
  readonly ehMao: boolean;
  /** Último a palpitar: não pode fechar a soma (o "pé"). */
  readonly ehPe: boolean;
  readonly className?: string;
}

function Simbolo({
  desenho,
  nome,
  tipo,
}: {
  desenho: readonly string[];
  nome: string;
  tipo: string;
}) {
  return (
    <span className={`simbolo simbolo--${tipo}`} role="img" aria-label={nome} title={nome}>
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
    <span className={classes('simbolos', className)}>
      {ehMao && <Simbolo desenho={DESENHO_MAO} nome="Mão: abre a rodada" tipo="mao" />}
      {ehPe && <Simbolo desenho={DESENHO_PE} nome="Pé: último a palpitar" tipo="pe" />}
    </span>
  );
}

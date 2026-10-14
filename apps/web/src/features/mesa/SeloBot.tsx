import { caminhoDoDesenho } from './pixel';

// Robô em pixel, na mesma grade dos símbolos de mão e pé: "X" é pixel aceso.
const DESENHO_ROBO: readonly string[] = [
  '....X....',
  '....X....',
  '.XXXXXXX.',
  'X.......X',
  'X.XX.XX.X',
  'X.......X',
  'X.XXXXX.X',
  '.XXXXXXX.',
  '..X...X..',
];

const CAMINHO_DO_ROBO = caminhoDoDesenho(DESENHO_ROBO);

/** Marca de bot ao lado do nome: o apelido não diz mais quem é bot. */
export function SeloBot() {
  return (
    <span className="selo-bot" role="img" aria-label="Bot" title="Bot">
      <svg viewBox="0 0 9 9" shapeRendering="crispEdges" aria-hidden="true">
        <path fill="currentColor" d={CAMINHO_DO_ROBO} />
      </svg>
    </span>
  );
}

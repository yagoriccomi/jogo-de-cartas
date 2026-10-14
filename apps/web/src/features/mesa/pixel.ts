import type { Naipe } from '@fodinha/shared';

// Mapas de pixels do baralho aprovado ('X' = pixel aceso). O valor e o naipe são desenhados em SVG
// com `shape-rendering: crispEdges`, então a carta não depende de nenhuma fonte e fica nítida.
const GLIFOS: Readonly<Record<string, readonly string[]>> = {
  A: ['.XXX.', 'X...X', 'X...X', 'XXXXX', 'X...X', 'X...X', 'X...X'],
  '2': ['.XXX.', 'X...X', '....X', '...X.', '..X..', '.X...', 'XXXXX'],
  '3': ['XXXX.', '....X', '....X', '.XXX.', '....X', '....X', 'XXXX.'],
  '4': ['...X.', '..XX.', '.X.X.', 'X..X.', 'XXXXX', '...X.', '...X.'],
  '5': ['XXXXX', 'X....', 'XXXX.', '....X', '....X', 'X...X', '.XXX.'],
  '6': ['..XX.', '.X...', 'X....', 'XXXX.', 'X...X', 'X...X', '.XXX.'],
  '7': ['XXXXX', '....X', '...X.', '..X..', '.X...', '.X...', '.X...'],
  '8': ['.XXX.', 'X...X', 'X...X', '.XXX.', 'X...X', 'X...X', '.XXX.'],
  '9': ['.XXX.', 'X...X', 'X...X', '.XXXX', '....X', '...X.', '.XX..'],
  '1': ['.X.', 'XX.', '.X.', '.X.', '.X.', '.X.', 'XXX'],
  '0': ['.XXX.', 'X...X', 'X..XX', 'X.X.X', 'XX..X', 'X...X', '.XXX.'],
  J: ['..XXX', '...X.', '...X.', '...X.', 'X..X.', 'X..X.', '.XX..'],
  Q: ['.XXX.', 'X...X', 'X...X', 'X...X', 'X.X.X', 'X..X.', '.XX.X'],
  K: ['X...X', 'X..X.', 'X.X..', 'XX...', 'X.X..', 'X..X.', 'X...X'],
  F: ['XXXXX', 'X....', 'X....', 'XXXX.', 'X....', 'X....', 'X....'],
};

const NAIPES_PIXEL: Readonly<Record<Naipe, readonly string[]>> = {
  espadas: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XX.X.XX.',
    '....X....',
    '...XXX...',
  ],
  copas: [
    '.........',
    '.XX...XX.',
    'XXXX.XXXX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ],
  ouros: [
    '....X....',
    '...XXX...',
    '..XXXXX..',
    '.XXXXXXX.',
    'XXXXXXXXX',
    '.XXXXXXX.',
    '..XXXXX..',
    '...XXX...',
    '....X....',
  ],
  paus: [
    '...XXX...',
    '..XXXXX..',
    '..XXXXX..',
    'XX.XXX.XX',
    'XXXXXXXXX',
    'XXXXXXXXX',
    'XX..X..XX',
    '....X....',
    '...XXX...',
  ],
};

/** Converte um mapa de pixels em um único `path` SVG, agrupando pixels consecutivos de cada linha. */
function caminho(linhas: readonly string[], deslocamentoX: number): string {
  let d = '';
  linhas.forEach((linha, y) => {
    let x = 0;
    while (x < linha.length) {
      if (linha[x] !== 'X') {
        x += 1;
        continue;
      }
      let fim = x;
      while (fim < linha.length && linha[fim] === 'X') fim += 1;
      const largura = fim - x;
      d += `M${x + deslocamentoX} ${y}h${largura}v1h-${largura}z`;
      x = fim;
    }
  });
  return d;
}

const cacheDeTextos = new Map<string, string>();

/** `path` de um texto em pixel ("10", "K", "F"); glifos separados por 1 pixel. Resultado em cache. */
export function caminhoDoTexto(texto: string): string {
  const guardado = cacheDeTextos.get(texto);
  if (guardado !== undefined) return guardado;

  let deslocamentoX = 0;
  let d = '';
  for (const caractere of texto) {
    const glifo = GLIFOS[caractere];
    if (!glifo) continue;
    d += caminho(glifo, deslocamentoX);
    deslocamentoX += (glifo[0]?.length ?? 0) + 1;
  }
  cacheDeTextos.set(texto, d);
  return d;
}

/** Largura, em pixels da grade, do texto desenhado por `caminhoDoTexto` (para alinhar à direita). */
export function colunasDoTexto(texto: string): number {
  let colunas = 0;
  for (const caractere of texto) {
    const glifo = GLIFOS[caractere];
    if (glifo) colunas += (glifo[0]?.length ?? 0) + 1;
  }
  return Math.max(colunas - 1, 1);
}

const cacheDeNaipes = new Map<Naipe, string>();

export function caminhoDoNaipe(naipe: Naipe): string {
  const guardado = cacheDeNaipes.get(naipe);
  if (guardado !== undefined) return guardado;
  const d = caminho(NAIPES_PIXEL[naipe], 0);
  cacheDeNaipes.set(naipe, d);
  return d;
}

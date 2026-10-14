import { useState } from 'react';
import { classes } from '../lib/classes';
import type { EstiloComVariaveis } from '../lib/estiloComVariaveis';
import './coracoes.css';

/** Desenho em pixel art, no mesmo estilo das cartas ('#' = pixel aceso). */
const DESENHO_DO_CORACAO: readonly string[] = [
  '.##.##.',
  '#######',
  '#######',
  '.#####.',
  '..###..',
  '...#...',
];
const VIEWBOX_CORACAO = `0 0 ${DESENHO_DO_CORACAO[0]?.length ?? 0} ${DESENHO_DO_CORACAO.length}`;

/** Une os pixels contíguos de cada linha em retângulos: caminho curto e sem costuras visíveis. */
function montarCaminho(linhas: readonly string[]): string {
  const retangulos: string[] = [];
  linhas.forEach((linha, y) => {
    for (const trecho of linha.matchAll(/#+/g)) {
      retangulos.push(`M${trecho.index} ${y}h${trecho[0].length}v1h-${trecho[0].length}z`);
    }
  });
  return retangulos.join('');
}

const CAMINHO_DO_CORACAO = montarCaminho(DESENHO_DO_CORACAO);

interface Props {
  readonly vidas: number;
  readonly vidasIniciais: number;
  readonly className?: string;
}

/**
 * Vidas como corações neon: um por vida inicial; os perdidos apagam da direita para a esquerda.
 * O coração que acabou de apagar pisca uma vez (a animação some com `prefers-reduced-motion`).
 */
export function Coracoes({ vidas, vidasIniciais, className }: Props) {
  const total = Math.max(vidasIniciais, 0);
  // Mais vidas que o inicial não deveria ocorrer; nesse caso todos acesos, sem inventar corações.
  const acesos = Math.min(Math.max(vidas, 0), total);

  // Ajuste durante a renderização (padrão do React) em vez de efeito: detecta a perda de vida sem
  // render extra visível. `recemApagados` guarda o intervalo de corações que acabaram de apagar.
  const [acesosAnteriores, definirAcesosAnteriores] = useState(acesos);
  const [recemApagados, definirRecemApagados] = useState<{ de: number; ate: number } | null>(null);
  if (acesos !== acesosAnteriores) {
    definirAcesosAnteriores(acesos);
    definirRecemApagados(acesos < acesosAnteriores ? { de: acesos, ate: acesosAnteriores } : null);
  }

  const descricao = `${acesos} de ${total} ${total === 1 ? 'vida' : 'vidas'}`;
  const estilo: EstiloComVariaveis = { '--total': total };

  return (
    <span
      className={classes('coracoes', className)}
      style={estilo}
      role="img"
      aria-label={descricao}
    >
      {Array.from({ length: total }, (_, indice) => {
        const aceso = indice < acesos;
        const apagando =
          recemApagados !== null && indice >= recemApagados.de && indice < recemApagados.ate;
        return (
          <svg
            key={indice}
            className={classes(
              'coracao',
              aceso ? 'coracao--aceso' : 'coracao--apagado',
              apagando && 'coracao--apagando',
            )}
            viewBox={VIEWBOX_CORACAO}
            shapeRendering="crispEdges"
            aria-hidden="true"
          >
            <path fill="currentColor" d={CAMINHO_DO_CORACAO} />
          </svg>
        );
      })}
    </span>
  );
}

import type { Reacao, ReacaoNaMesa } from '@fodinha/shared';

/** Cada emoji tem um movimento próprio, que combina com o som dele (`reacoes.css`). */
const MOVIMENTOS: Record<Reacao, string> = {
  '😂': 'balanco',
  '🔥': 'chama',
  '😱': 'tremor',
  '👏': 'palmas',
  '🤡': 'giro',
  '🍀': 'carimbo',
  '😭': 'choro',
  '🙏': 'reza',
};

/** 1 em cada 5 trevos (20%) sai dourado. */
const TREVO_DOURADO_A_CADA = 5;

/**
 * O sorteio sai do autor e do instante que o servidor carimbou: todos na mesa veem o mesmo
 * trevo, sem mudar o contrato.
 */
export function ehTrevoDourado(reacao: ReacaoNaMesa): boolean {
  if (reacao.reacao !== '🍀') return false;
  let hash = reacao.em;
  for (const caractere of reacao.jogadorId) hash = (hash * 31 + caractere.charCodeAt(0)) | 0;
  return Math.abs(hash) % TREVO_DOURADO_A_CADA === 0;
}

interface Props {
  readonly reacao: Reacao;
  readonly dourado?: boolean;
}

export function EmojiAnimado({ reacao, dourado = false }: Props) {
  const classes = `emoji-animado emoji-animado--${MOVIMENTOS[reacao]}`;
  return (
    <span className={dourado ? `${classes} emoji-animado--dourado` : classes} aria-hidden="true">
      {reacao}
    </span>
  );
}

import { useAgora } from '../../lib/useAgora';

const SEGUNDOS_URGENTE = 5;

interface Props {
  /** Epoch ms em que o servidor joga pelo jogador da vez. */
  readonly prazoEm: number;
}

export function ContagemRegressiva({ prazoEm }: Props) {
  const agora = useAgora();
  // O servidor é a autoridade do prazo; aqui só exibimos, nunca decidimos nada.
  const segundos = Math.max(0, Math.ceil((prazoEm - agora) / 1000));
  const urgente = segundos <= SEGUNDOS_URGENTE;

  return (
    <span
      className={`contagem${urgente ? ' contagem--urgente' : ''}`}
      role="timer"
      aria-label={`${segundos} segundos restantes`}
    >
      {segundos}s
    </span>
  );
}

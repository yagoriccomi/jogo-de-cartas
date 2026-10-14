import { useAgora } from '../../lib/useAgora';

const SEGUNDOS_URGENTE = 5;
const MS_POR_SEGUNDO = 1000;

interface Props {
  /** Instante local (epoch ms) em que o prazo acaba: recebimento do estado + tempo restante do servidor. */
  readonly prazoFinal: number;
  readonly className?: string;
}

export function ContagemRegressiva({ prazoFinal, className = 'contagem' }: Props) {
  const agora = useAgora();
  // O servidor é a autoridade do prazo; aqui só exibimos, nunca decidimos nada.
  const segundos = Math.max(0, Math.ceil((prazoFinal - agora) / MS_POR_SEGUNDO));
  const urgente = segundos <= SEGUNDOS_URGENTE;

  return (
    <span
      className={`${className}${urgente ? ' contagem--urgente' : ''}`}
      role="timer"
      aria-label={`${segundos} segundos restantes`}
    >
      {segundos}s
    </span>
  );
}

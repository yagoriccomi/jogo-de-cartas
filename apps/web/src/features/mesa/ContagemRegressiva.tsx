import { useTicTac } from '../som/useTicTac';
import { useAgora } from '../../lib/useAgora';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';

const SEGUNDOS_URGENTE = 5;
/** A partir daqui o meu contador pulsa, cada vez mais forte até o zero. */
const SEGUNDOS_PULSANDO = 10;
/** A partir daqui toca o tic-tac (só para quem está com a vez). */
const SEGUNDOS_TIC_TAC = 5;
const MS_POR_SEGUNDO = 1000;

interface Props {
  /** Instante local (epoch ms) em que o prazo acaba: recebimento do estado + tempo restante do servidor. */
  readonly prazoFinal: number;
  readonly className?: string;
  /** O prazo é o meu: pulsa e faz tic-tac no fim. O dos outros só conta. */
  readonly alertar?: boolean;
}

export function ContagemRegressiva({ prazoFinal, className = 'contagem', alertar = false }: Props) {
  const agora = useAgora();
  // O servidor é a autoridade do prazo; aqui só exibimos, nunca decidimos nada.
  const segundos = Math.max(0, Math.ceil((prazoFinal - agora) / MS_POR_SEGUNDO));
  const urgente = segundos <= SEGUNDOS_URGENTE;
  const pulsando = alertar && segundos <= SEGUNDOS_PULSANDO;
  useTicTac(segundos, alertar && segundos <= SEGUNDOS_TIC_TAC && segundos > 0);
  // 0 no começo do pulso e 1 no zero: o CSS cresce escala, brilho e ritmo com ela.
  const estilo: EstiloComVariaveis | undefined = pulsando
    ? { '--urgencia': (SEGUNDOS_PULSANDO - segundos) / SEGUNDOS_PULSANDO }
    : undefined;

  return (
    <span
      className={`${className}${urgente ? ' contagem--urgente' : ''}${pulsando ? ' contagem--pulsando' : ''}`}
      style={estilo}
      role="timer"
      aria-label={`${segundos} segundos restantes`}
    >
      {segundos}s
    </span>
  );
}

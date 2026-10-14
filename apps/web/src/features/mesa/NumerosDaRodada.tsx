import { classes } from '../../lib/classes';

interface Props {
  readonly palpite: number | null;
  readonly feitas: number;
  /**
   * Quando informado, o "Fez" também é o destino do voo do montinho (celular, onde as miniaturas
   * não cabem): a animação da vaza termina nele.
   */
  readonly destinoDoMonte?: string;
  readonly className?: string;
}

type Situacao = 'aberta' | 'certa' | 'estourou';

/** Fez mais que pediu já não tem volta; fez exatamente o que pediu está, por ora, salvo. */
function situacaoDe(palpite: number | null, feitas: number): Situacao {
  if (palpite === null || feitas < palpite) return 'aberta';
  return feitas === palpite ? 'certa' : 'estourou';
}

/**
 * Palpite e vazas feitas em duas caixinhas rotuladas, lidas de relance. A cor do "Fez" adianta
 * o resultado: ciano quando bate com o palpite, rosa quando já passou.
 */
export function NumerosDaRodada({ palpite, feitas, destinoDoMonte, className }: Props) {
  const situacao = situacaoDe(palpite, feitas);
  const descricao = `Palpite ${palpite ?? 'ainda não dado'}, fez ${feitas}`;
  return (
    <div className={classes('numeros', className)} role="img" aria-label={descricao}>
      <span className="numeros__item">
        <span className="numeros__rotulo">Palpite</span>
        <span className="numeros__valor">{palpite ?? '–'}</span>
      </span>
      <span
        className={classes('numeros__item', `numeros__item--${situacao}`)}
        data-monte-destino={destinoDoMonte}
      >
        <span className="numeros__rotulo">Fez</span>
        <span className="numeros__valor">{feitas}</span>
      </span>
    </div>
  );
}

import type { CartaNaMao, Valor } from '@fodinha/shared';
import { Carta } from './Carta';

interface Props {
  readonly cartas: readonly CartaNaMao[];
  readonly manilha: Valor | null;
  /** Só `true` na minha vez e na fase de jogar; fora disso as cartas ficam inertes. */
  readonly podeJogar: boolean;
  readonly onJogar: (cartaId: string) => void;
}

// Mãos grandes (poucos jogadores) encolhem as cartas para caberem sem rolagem horizontal.
const LIMITE_MAO_GRANDE = 6;

export function Mao({ cartas, manilha, podeJogar, onJogar }: Props) {
  if (cartas.length === 0) {
    return <p className="mao__vazia">Você não tem cartas nesta rodada.</p>;
  }

  const tamanho = cartas.length > LIMITE_MAO_GRANDE ? 'm' : 'g';

  return (
    <ul className="mao" aria-label="Sua mão">
      {cartas.map((carta) => (
        <li key={carta.id}>
          {podeJogar ? (
            <Carta
              carta={carta}
              tamanho={tamanho}
              manilha={manilha}
              selecionavel
              onClick={() => onJogar(carta.id)}
            />
          ) : (
            <div className="mao__inerte">
              <Carta carta={carta} tamanho={tamanho} manilha={manilha} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

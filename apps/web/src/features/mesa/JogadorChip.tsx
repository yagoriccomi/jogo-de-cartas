import type { JogadorVisivel, Valor } from '@fodinha/shared';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';

interface Props {
  readonly jogador: JogadorVisivel;
  readonly ehEu: boolean;
  readonly ehPe: boolean;
  readonly ehDaVez: boolean;
  readonly prazoDaVezEm: number | null;
  readonly manilha: Valor | null;
}

function IconeVida() {
  return (
    <svg className="chip__vida-icone" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 21s-8-5.500-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 10c0 5.500-8 11-8 11z" />
    </svg>
  );
}

export function JogadorChip({ jogador, ehEu, ehPe, ehDaVez, prazoDaVezEm, manilha }: Props) {
  const classes = ['chip'];
  if (ehDaVez) classes.push('chip--vez');
  if (ehEu) classes.push('chip--eu');
  if (jogador.eliminado) classes.push('chip--eliminado');
  if (!jogador.conectado && !jogador.ehBot) classes.push('chip--offline');

  return (
    <li className={classes.join(' ')} aria-current={ehDaVez ? 'true' : undefined}>
      <div className="chip__corpo">
        <span className="chip__nome">
          {jogador.apelido}
          {ehEu && <span className="chip__voce"> (você)</span>}
        </span>
        <span className="chip__vidas" aria-label={`${jogador.vidas} vidas`}>
          <IconeVida />
          {jogador.vidas}
        </span>
        <span className="chip__placar">
          {jogador.eliminado
            ? 'Eliminado'
            : `Palpite ${jogador.palpite ?? '–'} · Fez ${jogador.vazasFeitas}`}
        </span>
        <span className="chip__selos">
          {ehPe && <span className="selo selo--destaque">Pé</span>}
          {jogador.ehBot && <span className="selo">Bot</span>}
          {!jogador.conectado && !jogador.ehBot && (
            <span className="selo selo--alerta">Offline</span>
          )}
          {ehDaVez && prazoDaVezEm !== null && <ContagemRegressiva prazoEm={prazoDaVezEm} />}
        </span>
      </div>
      {jogador.cartaNaTesta && (
        <Carta
          carta={jogador.cartaNaTesta}
          tamanho="p"
          manilha={manilha}
          rotulo={`Testa de ${jogador.apelido}`}
        />
      )}
    </li>
  );
}

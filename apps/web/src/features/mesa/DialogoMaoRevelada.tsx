import type { JogadorVisivel, Valor } from '@fodinha/shared';
import { Dialogo } from '../../componentes/Dialogo';
import { IconeFechar } from '../../componentes/Icones';
import { Carta } from './Carta';
import './mao-revelada.css';

/** Cartas legíveis sem ocupar a tela: até 13 cartas cabem em duas linhas no celular. */
const LARGURA_DA_CARTA = 58;

interface Props {
  readonly jogador: JogadorVisivel;
  readonly manilha: Valor | null;
  readonly onFechar: () => void;
}

/**
 * Mão de um adversário, para quem já foi eliminado (e só se o dono permitir). Acompanha a
 * partida ao vivo: a cada carta jogada o servidor manda a mão atualizada.
 */
export function DialogoMaoRevelada({ jogador, manilha, onFechar }: Props) {
  const cartas = jogador.maoRevelada ?? [];
  const idTitulo = `titulo-mao-${jogador.id}`;

  return (
    <Dialogo idTitulo={idTitulo} destaque="rosa" onFechar={onFechar}>
      <div className="dialogo__cabecalho">
        <h2 id={idTitulo} className="neon dialogo__titulo">
          Mão de {jogador.apelido}
        </h2>
        <button
          type="button"
          className="botao botao--texto botao--icone"
          aria-label="Fechar"
          onClick={onFechar}
        >
          <IconeFechar />
        </button>
      </div>

      {cartas.length === 0 ? (
        <p className="mao-revelada__vazia">
          {jogador.maoRevelada === null
            ? 'O dono da sala desligou a visão das cartas.'
            : 'Sem cartas na mão agora.'}
        </p>
      ) : (
        <ul className="mao-revelada" aria-label={`Cartas de ${jogador.apelido}`}>
          {cartas.map((carta) => (
            <li key={carta.id}>
              <Carta carta={carta} manilha={manilha} largura={LARGURA_DA_CARTA} />
            </li>
          ))}
        </ul>
      )}
      <p className="mao-revelada__nota">Só quem já foi eliminado vê isto.</p>
    </Dialogo>
  );
}

import { Dialogo } from '../../componentes/Dialogo';
import { IconeFechar } from '../../componentes/Icones';

interface Props {
  readonly onFechar: () => void;
}

/** Resumo das regras para consulta durante a partida. */
export function DialogoRegras({ onFechar }: Props) {
  return (
    <Dialogo idTitulo="titulo-regras" onFechar={onFechar}>
      <div className="dialogo__cabecalho">
        <h2 id="titulo-regras" className="neon neon--ciano dialogo__titulo">
          Regras do jogo
        </h2>
        <button
          type="button"
          className="botao botao--texto botao--icone"
          aria-label="Fechar regras"
          onClick={onFechar}
        >
          <IconeFechar />
        </button>
      </div>
      <ul className="regras">
        <li>
          <strong>Palpite.</strong> Em cada rodada você vê suas cartas e diz quantas vazas acha que
          vai fazer. Quem abre a rodada (ficha 1º) palpita primeiro.
        </li>
        <li>
          <strong>O pé.</strong> O último a palpitar não pode escolher o número que faria a soma dos
          palpites fechar com o total de cartas: alguém precisa errar.
        </li>
        <li>
          <strong>Manilha.</strong> É o valor logo acima da vira e vence qualquer outra carta. Entre
          manilhas, o naipe decide: paus, copas, espadas e ouros (do mais forte ao mais fraco).
        </li>
        <li>
          <strong>Ordem das cartas.</strong> 3, 2, A, K, J, Q, 10, 9, 8, 7, 6, 5 e 4 (do mais forte
          ao mais fraco; 8, 9 e 10 só entram se a sala permitir).
        </li>
        <li>
          <strong>Cartas iguais se anulam.</strong> Se duas ou mais cartas comuns de mesmo valor
          empatam, a próxima maior vence. Se todas se anulam, ninguém leva a vaza.
        </li>
        <li>
          <strong>Vidas.</strong> No fim da rodada você perde 1 vida por vaza de diferença entre o
          palpite e o que fez. Quem zera as vidas é eliminado; o último de pé vence.
        </li>
        <li>
          <strong>Rodada de 1 carta é cega.</strong> Você vê a carta dos outros, mas não a sua.
        </li>
        <li>
          <strong>Sequência das rodadas.</strong> 1 carta, depois 2, 3… até o máximo que o baralho
          permite, e volta a 1.
        </li>
        <li>
          <strong>Tempo.</strong> Se o tempo da sua vez acabar, o jogo joga por você.
        </li>
      </ul>
      <button type="button" className="botao botao--bloco" onClick={onFechar}>
        Entendi
      </button>
    </Dialogo>
  );
}

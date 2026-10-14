import { Dialogo } from '../../componentes/Dialogo';
import { IconeFechar } from '../../componentes/Icones';
import { GuiaDeRegras } from '../regras/GuiaDeRegras';

interface Props {
  readonly onFechar: () => void;
}

/** Regras do jogo em slides ilustrados, para aprender ou consultar durante a partida. */
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
      <GuiaDeRegras onFechar={onFechar} />
    </Dialogo>
  );
}

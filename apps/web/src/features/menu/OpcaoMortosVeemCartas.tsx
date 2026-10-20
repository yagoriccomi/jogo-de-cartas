import { IconeOlho } from '../../componentes/Icones';
import { definirMortosVeemCartas } from '../../estado/acoes';
import { useAcao } from '../../lib/useAcao';

interface Props {
  readonly ligada: boolean;
  readonly souDono: boolean;
}

/**
 * Item do menu: se os eliminados podem ver a mão dos outros tocando na placa deles. Todos veem
 * como está (para saber se alguém de fora da disputa enxerga as cartas); só o dono troca.
 */
export function OpcaoMortosVeemCartas({ ligada, souDono }: Props) {
  const [ocupado, executar] = useAcao();
  const estado = ligada ? 'Ligado' : 'Desligado';
  const conteudo = (
    <>
      <IconeOlho />
      <span className="menu__texto">
        Eliminados veem as cartas
        <small>
          {souDono ? 'Tocando na placa de quem ainda joga' : 'Só o dono da sala pode mudar'}
        </small>
      </span>
      <span className="menu__seta">{estado}</span>
    </>
  );

  if (!souDono) {
    return <div className="menu__item">{conteudo}</div>;
  }
  return (
    <button
      type="button"
      className="menu__item"
      role="switch"
      aria-checked={ligada}
      disabled={ocupado}
      onClick={() => void executar(() => definirMortosVeemCartas(!ligada))}
    >
      {conteudo}
    </button>
  );
}

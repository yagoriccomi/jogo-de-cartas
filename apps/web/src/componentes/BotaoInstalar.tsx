import { useInstalacao } from '../lib/useInstalacao';
import { IconeInstalar } from './Icones';

/** Convite para "Adicionar à tela inicial"; some quando o navegador não oferece a instalação. */
export function BotaoInstalar() {
  const { podeInstalar, instalar } = useInstalacao();
  if (!podeInstalar) return null;

  return (
    <button
      type="button"
      className="botao botao--texto botao--bloco"
      onClick={() => void instalar()}
    >
      <IconeInstalar />
      Instalar na tela inicial
    </button>
  );
}

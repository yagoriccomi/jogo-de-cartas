import { useInstalacao } from '../lib/useInstalacao';
import { IconeCompartilhar, IconeInstalar } from './Icones';

/**
 * Convite para "Adicionar à tela inicial". No iPhone o Safari não deixa o site oferecer a
 * instalação: no lugar do botão vai o passo a passo pelo menu Compartilhar.
 */
export function BotaoInstalar() {
  const { podeInstalar, instalarPeloCompartilhar, instalar } = useInstalacao();
  if (instalarPeloCompartilhar) {
    return (
      <p className="aviso-instalar">
        <IconeInstalar />
        <span>
          Instale o jogo: toque em <strong>Compartilhar</strong>{' '}
          <IconeCompartilhar className="icone aviso-instalar__compartilhar" /> e depois em{' '}
          <strong>Adicionar à Tela de Início</strong>.
        </span>
      </p>
    );
  }
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

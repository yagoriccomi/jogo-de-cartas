import { Dialogo } from '../../componentes/Dialogo';
import { entrarComGoogle } from './login';
import { AVISO_DO_LOGIN } from './textos';

interface Props {
  readonly onFechar: () => void;
}

/** A "tela de login": o que é guardado, antes de sair do site rumo ao Google. */
export function DialogoDoLogin({ onFechar }: Props) {
  return (
    <Dialogo idTitulo="titulo-login" onFechar={onFechar}>
      <h2 id="titulo-login" className="neon dialogo__titulo">
        Entrar com Google
      </h2>
      <ul className="login__privacidade">
        {AVISO_DO_LOGIN.map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
      </ul>
      <div className="dialogo__acoes">
        <button type="button" className="botao" onClick={onFechar}>
          Agora não
        </button>
        <button type="button" className="botao botao--primario" onClick={entrarComGoogle}>
          Continuar
        </button>
      </div>
    </Dialogo>
  );
}

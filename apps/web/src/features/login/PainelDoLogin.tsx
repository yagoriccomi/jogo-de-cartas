import { IconeFechar } from '../../componentes/Icones';
import { useAcao } from '../../lib/useAcao';
import { dispensarAvisoDoLogin, entrarComGoogle, sairDaConta, useLogin } from './login';
import './login.css';

/**
 * Conta Google na entrada, como alternativa ao apelido: botão para entrar ou quem está logado e
 * "Sair". Some por inteiro quando o servidor não tem login (ou ainda não respondeu): o convidado
 * nunca espera por ele.
 */
export function PainelDoLogin() {
  const { situacao, aviso } = useLogin();
  const [saindo, executar] = useAcao();

  const avisoDeFalha = aviso && (
    <div className="login__aviso" role="alert">
      <span>{aviso}</span>
      <button
        type="button"
        className="botao botao--texto botao--icone"
        aria-label="Fechar aviso"
        onClick={dispensarAvisoDoLogin}
      >
        <IconeFechar />
      </button>
    </div>
  );

  if (situacao.fase === 'verificando' || situacao.fase === 'indisponivel') return avisoDeFalha;

  if (situacao.fase === 'logado') {
    const { nome, email } = situacao.conta;
    return (
      <section className="login login--logado" aria-label="Sua conta">
        {avisoDeFalha}
        <p className="login__quem">
          <span className="login__rotulo">Logado como</span>
          <strong className="login__nome">{nome}</strong>
          <span className="login__email">{email}</span>
        </p>
        <button
          type="button"
          className="botao botao--texto login__sair"
          disabled={saindo}
          onClick={() => void executar(sairDaConta)}
        >
          Sair da conta
        </button>
      </section>
    );
  }

  return (
    <section className="login" aria-label="Conta (opcional)">
      {avisoDeFalha}
      <button type="button" className="botao botao--bloco login__entrar" onClick={entrarComGoogle}>
        Entrar com Google
      </button>
    </section>
  );
}

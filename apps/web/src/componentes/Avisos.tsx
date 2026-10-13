import { dispensarAviso, useApp } from '../estado/armazem';

/** Toasts amigáveis; `aria-live` garante que leitores de tela anunciem erros sem roubar o foco. */
export function Avisos() {
  const { avisos } = useApp();

  return (
    <div className="avisos" aria-live="polite">
      {avisos.map((aviso) => (
        <div
          key={aviso.id}
          className={`aviso aviso--${aviso.tipo}`}
          role={aviso.tipo === 'erro' ? 'alert' : 'status'}
        >
          <span className="aviso__texto">{aviso.mensagem}</span>
          <button
            type="button"
            className="aviso__fechar"
            aria-label="Fechar aviso"
            onClick={() => dispensarAviso(aviso.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

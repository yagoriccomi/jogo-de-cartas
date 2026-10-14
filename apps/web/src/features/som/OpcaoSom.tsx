import { definirSomLigado, useSomLigado } from './preferencia';

/** Item do menu lateral que liga e desliga som e vibração juntos. */
export function OpcaoSom() {
  const ligado = useSomLigado();
  return (
    <button
      type="button"
      className="menu__item"
      role="switch"
      aria-checked={ligado}
      onClick={() => definirSomLigado(!ligado)}
    >
      <svg
        className="icone"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M4 9v6h4l5 4V5L8 9z" />
        {ligado ? (
          <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" />
        ) : (
          <path d="M17 9l5 6M22 9l-5 6" />
        )}
      </svg>
      <span className="menu__texto">Som e vibração</span>
      <span className="menu__seta">{ligado ? 'Ligado' : 'Desligado'}</span>
    </button>
  );
}

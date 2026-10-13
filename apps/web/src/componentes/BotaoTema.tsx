import { useTema, type PreferenciaTema } from '../lib/tema';

const ROTULOS: Record<PreferenciaTema, string> = {
  auto: 'Tema: automático',
  claro: 'Tema: claro',
  escuro: 'Tema: escuro',
};

export function BotaoTema() {
  const { preferencia, alternar } = useTema();
  return (
    <button
      type="button"
      className="botao botao--discreto"
      onClick={alternar}
      aria-label={`${ROTULOS[preferencia]}. Clique para alternar.`}
      title={ROTULOS[preferencia]}
    >
      {ROTULOS[preferencia]}
    </button>
  );
}

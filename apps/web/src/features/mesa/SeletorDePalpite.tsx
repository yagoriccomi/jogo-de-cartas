import { useState } from 'react';

interface Props {
  readonly cartasNaRodada: number;
  readonly palpiteProibido: number | null;
  readonly ocupado: boolean;
  readonly onConfirmar: (quantidade: number) => void;
}

export function SeletorDePalpite({ cartasNaRodada, palpiteProibido, ocupado, onConfirmar }: Props) {
  const [escolhido, definirEscolhido] = useState<number | null>(null);
  const opcoes = Array.from({ length: cartasNaRodada + 1 }, (_, quantidade) => quantidade);

  return (
    <div className="palpite">
      <p className="palpite__titulo">Quantas vazas você vai fazer?</p>
      <div className="palpite__opcoes" role="radiogroup" aria-label="Seu palpite">
        {opcoes.map((quantidade) => {
          const proibido = quantidade === palpiteProibido;
          return (
            <button
              key={quantidade}
              type="button"
              role="radio"
              aria-checked={escolhido === quantidade}
              className="palpite__opcao"
              disabled={proibido || ocupado}
              title={proibido ? 'Você é o pé: este palpite não é permitido' : undefined}
              onClick={() => definirEscolhido(quantidade)}
            >
              {quantidade}
            </button>
          );
        })}
      </div>
      {palpiteProibido !== null && (
        <p className="palpite__dica">Você é o pé: não pode palpitar {palpiteProibido}.</p>
      )}
      <button
        type="button"
        className="botao botao--primario botao--bloco"
        disabled={escolhido === null || ocupado}
        onClick={() => escolhido !== null && onConfirmar(escolhido)}
      >
        {escolhido === null ? 'Escolha um palpite' : `Confirmar palpite: ${escolhido}`}
      </button>
    </div>
  );
}

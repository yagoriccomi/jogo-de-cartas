import type { ReactNode } from 'react';
import { ehCartaOculta, type CartaNaMao, type Naipe, type Valor } from '@fodinha/shared';

export type TamanhoCarta = 'p' | 'm' | 'g';

const NAIPE_VERMELHO: Record<Naipe, boolean> = {
  ouros: true,
  copas: true,
  espadas: false,
  paus: false,
};

// Naipes desenhados em SVG para ficarem nítidos em qualquer tamanho, sem imagens externas.
const CAMINHOS: Record<Naipe, string> = {
  copas:
    'M12 21s-8-5.500-8-11a4.500 4.500 0 0 1 8-2.800A4.500 4.500 0 0 1 20 10c0 5.500-8 11-8 11z',
  ouros: 'M12 2l7 10-7 10-7-10z',
  espadas:
    'M12 2c3 4 8 7 8 12a4.500 4.500 0 0 1-7.200 3.600c.2 1.800.9 3 2.200 4.400H9c1.300-1.400 2-2.600 2.200-4.400A4.500 4.500 0 0 1 4 14c0-5 5-8 8-12z',
  paus: 'M12 3a4.300 4.300 0 0 1 2.600 7.700A4.300 4.300 0 1 1 16.700 18a4.300 4.300 0 0 1-3.200-1.500c.1 1.800.7 3.200 1.700 4.500H8.800c1-1.300 1.600-2.700 1.700-4.500A4.300 4.300 0 1 1 7.300 10.700 4.300 4.300 0 0 1 12 3z',
};

export function IconeNaipe({ naipe }: { readonly naipe: Naipe }) {
  return (
    <svg className="naipe" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d={CAMINHOS[naipe]} />
    </svg>
  );
}

interface Props {
  readonly carta: CartaNaMao | null;
  readonly tamanho?: TamanhoCarta;
  /** Valor da manilha da rodada: destaca visualmente as cartas que a têm. */
  readonly manilha?: Valor | null;
  readonly selecionavel?: boolean;
  readonly onClick?: () => void;
  readonly rotulo?: string;
}

export function Carta({
  carta,
  tamanho = 'm',
  manilha = null,
  selecionavel = false,
  onClick,
  rotulo,
}: Props) {
  const classes = ['carta', `carta--${tamanho}`];
  let conteudo: ReactNode;
  let descricao: string;

  if (carta === null || ehCartaOculta(carta)) {
    classes.push('carta--verso');
    conteudo = null;
    descricao = 'Carta virada';
  } else {
    classes.push(NAIPE_VERMELHO[carta.naipe] ? 'carta--vermelha' : 'carta--preta');
    if (manilha !== null && carta.valor === manilha) classes.push('carta--manilha');
    descricao = `${carta.valor} de ${carta.naipe}`;
    conteudo = (
      <>
        <span className="carta__canto">
          <span className="carta__valor">{carta.valor}</span>
          <IconeNaipe naipe={carta.naipe} />
        </span>
        <span className="carta__centro">
          <IconeNaipe naipe={carta.naipe} />
        </span>
      </>
    );
  }

  const textoAcessivel = rotulo ? `${rotulo}: ${descricao}` : descricao;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${classes.join(' ')} carta--clicavel${selecionavel ? ' carta--ativa' : ''}`}
        onClick={onClick}
        aria-label={textoAcessivel}
      >
        {conteudo}
      </button>
    );
  }

  return (
    <div className={classes.join(' ')} role="img" aria-label={textoAcessivel}>
      {conteudo}
    </div>
  );
}

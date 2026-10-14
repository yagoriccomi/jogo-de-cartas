import { useState, type ReactNode } from 'react';
import { IconeMenu } from '../../componentes/Icones';
import { MenuLateral } from './MenuLateral';
import './menu.css';

interface Props {
  /** Informação central do topo (ex.: "Rodada 3 · 3 cartas"). */
  readonly children?: ReactNode;
}

/** Topo comum ao lobby e à mesa: marca, informação da rodada e o botão que abre o menu lateral. */
export function CabecalhoApp({ children }: Props) {
  const [menuAberto, definirMenuAberto] = useState(false);

  return (
    <header className="cabecalho">
      <span className="neon cabecalho__marca">Fodinha</span>
      <div className="cabecalho__info">{children}</div>
      <button
        type="button"
        className="botao botao--icone"
        aria-label="Abrir menu"
        aria-haspopup="dialog"
        aria-expanded={menuAberto}
        onClick={() => definirMenuAberto(true)}
      >
        <IconeMenu />
      </button>
      {menuAberto && <MenuLateral onFechar={() => definirMenuAberto(false)} />}
    </header>
  );
}

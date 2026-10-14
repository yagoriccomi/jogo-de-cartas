import { useEffect, useRef, useState, type ReactNode } from 'react';
import { IconeAbaixo, IconeMenu } from '../../componentes/Icones';
import { classes } from '../../lib/classes';
import { MenuLateral } from './MenuLateral';
import './menu.css';

/** Deslocamento vertical mínimo do dedo para valer como gesto de abrir/fechar o topo. */
const DISTANCIA_DO_GESTO_PX = 36;
/** Só um gesto que começa perto da borda de cima abre o topo; no resto da tela o dedo é do jogo. */
const FAIXA_DO_GESTO_PX = 90;

interface Props {
  /** Informação central do topo (ex.: "Rodada 3 · 3 cartas"). */
  readonly children?: ReactNode;
  /** Botões extras ao lado do menu (ex.: placar e regras na mesa). */
  readonly acoes?: ReactNode;
  /**
   * Celular na mesa: o topo fica escondido para sobrar área de jogo; resta só uma alça pequena
   * com a informação. Tocar nela ou deslizar o dedo para baixo a partir do topo abre o topo por
   * cima da mesa; deslizar para cima, tocar fora ou usar uma ação fecha.
   */
  readonly recolhivel?: boolean;
}

function useGestoDoTopo(ativo: boolean, aberto: boolean, definirAberto: (v: boolean) => void) {
  const inicio = useRef<number | null>(null);
  useEffect(() => {
    if (!ativo) return;
    function aoTocar(evento: TouchEvent) {
      const y = evento.touches[0]?.clientY;
      inicio.current = y !== undefined && (aberto || y < FAIXA_DO_GESTO_PX) ? y : null;
    }
    function aoSoltar(evento: TouchEvent) {
      const comeco = inicio.current;
      const fim = evento.changedTouches[0]?.clientY;
      inicio.current = null;
      if (comeco === null || fim === undefined) return;
      if (!aberto && fim - comeco > DISTANCIA_DO_GESTO_PX) definirAberto(true);
      if (aberto && comeco - fim > DISTANCIA_DO_GESTO_PX) definirAberto(false);
    }
    window.addEventListener('touchstart', aoTocar, { passive: true });
    window.addEventListener('touchend', aoSoltar, { passive: true });
    return () => {
      window.removeEventListener('touchstart', aoTocar);
      window.removeEventListener('touchend', aoSoltar);
    };
  }, [ativo, aberto, definirAberto]);
}

/** Topo comum ao lobby e à mesa: marca, informação da rodada e o botão que abre o menu lateral. */
export function CabecalhoApp({ children, acoes, recolhivel = false }: Props) {
  const [menuAberto, definirMenuAberto] = useState(false);
  const [topoAberto, definirTopoAberto] = useState(false);
  useGestoDoTopo(recolhivel, topoAberto, definirTopoAberto);

  const abrirMenu = () => {
    definirTopoAberto(false);
    definirMenuAberto(true);
  };

  return (
    <>
      <header
        className={classes(
          'cabecalho',
          recolhivel && 'cabecalho--recolhivel',
          topoAberto && 'cabecalho--aberto',
        )}
      >
        <span className="neon cabecalho__marca">Fodinha</span>
        <div className="cabecalho__info">{children}</div>
        {acoes && (
          // Usar uma ação (placar, regras) já fecha o topo: o diálogo aberto toma a frente.
          <div className="cabecalho__acoes" onClickCapture={() => definirTopoAberto(false)}>
            {acoes}
          </div>
        )}
        <button
          type="button"
          className="botao botao--icone"
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          aria-expanded={menuAberto}
          onClick={abrirMenu}
        >
          <IconeMenu />
        </button>
      </header>
      {recolhivel && !topoAberto && (
        <button
          type="button"
          className="alca-topo"
          aria-expanded={false}
          aria-label="Mostrar o topo: placar, regras e menu"
          onClick={() => definirTopoAberto(true)}
        >
          <span className="alca-topo__texto">{children}</span>
          <IconeAbaixo className="icone alca-topo__seta" />
        </button>
      )}
      {recolhivel && topoAberto && (
        <button
          type="button"
          className="cabecalho__fundo"
          aria-label="Esconder o topo"
          onClick={() => definirTopoAberto(false)}
        />
      )}
      {menuAberto && <MenuLateral onFechar={() => definirMenuAberto(false)} />}
    </>
  );
}

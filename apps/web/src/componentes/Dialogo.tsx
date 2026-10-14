import { useEffect, useRef, type ReactNode } from 'react';
import { classes } from '../lib/classes';

export type VarianteDialogo = 'centro' | 'folha' | 'gaveta';

interface Props {
  /** Id do elemento que dá nome ao diálogo (`aria-labelledby`). */
  readonly idTitulo: string;
  readonly papel?: 'dialog' | 'alertdialog';
  readonly variante?: VarianteDialogo;
  readonly destaque?: 'ciano' | 'rosa';
  /** Sem `onFechar` o diálogo não fecha por Esc nem por clique fora (ex.: votação de pausa). */
  readonly onFechar?: () => void;
  readonly children: ReactNode;
}

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Diálogos empilhados (ex.: confirmação aberta de dentro da gaveta): só o do topo reage ao teclado.
const pilha: symbol[] = [];

/** Casca acessível de diálogo: foco preso, Esc fecha, foco volta a quem abriu. */
export function Dialogo({
  idTitulo,
  papel = 'dialog',
  variante = 'centro',
  destaque = variante === 'centro' ? 'ciano' : 'rosa',
  onFechar,
  children,
}: Props) {
  const caixa = useRef<HTMLDivElement>(null);
  const aoFechar = useRef(onFechar);
  aoFechar.current = onFechar;

  useEffect(() => {
    const caixaAtual = caixa.current;
    if (!caixaAtual) return;
    const marca = Symbol('dialogo');
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pilha.push(marca);

    const focaveis = () => Array.from(caixaAtual.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL));
    (focaveis()[0] ?? caixaAtual).focus();

    function aoTeclar(evento: KeyboardEvent) {
      if (pilha[pilha.length - 1] !== marca) return;
      if (evento.key === 'Escape' && aoFechar.current) {
        evento.stopPropagation();
        aoFechar.current();
        return;
      }
      if (evento.key !== 'Tab') return;
      const itens = focaveis();
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (!primeiro || !ultimo) {
        evento.preventDefault();
        return;
      }
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    }

    document.addEventListener('keydown', aoTeclar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      const indice = pilha.indexOf(marca);
      if (indice >= 0) pilha.splice(indice, 1);
      // Devolve o foco a quem abriu o diálogo (se ainda existir na página).
      if (anterior && anterior.isConnected) anterior.focus();
    };
  }, []);

  return (
    <div
      className={classes(
        'sobreposicao',
        variante === 'folha' && 'sobreposicao--folha',
        variante === 'gaveta' && 'sobreposicao--gaveta',
      )}
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onFechar?.();
      }}
    >
      <div
        ref={caixa}
        className={classes(
          'dialogo',
          destaque === 'rosa' && 'dialogo--rosa',
          variante === 'folha' && 'dialogo--folha',
          variante === 'gaveta' && 'dialogo--gaveta',
        )}
        role={papel}
        aria-modal="true"
        aria-labelledby={idTitulo}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );
}

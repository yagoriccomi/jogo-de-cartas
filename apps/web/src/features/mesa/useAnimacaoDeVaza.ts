import { useEffect, useRef, useState, type RefObject } from 'react';
import type { VazaResolvida } from '@fodinha/shared';

/** O servidor limpa a mesa no mesmo estado que fecha a vaza: seguramos as cartas para serem vistas. */
const PAUSA_ANTES_DO_VOO_MS = 800;
const DURACAO_DO_VOO_MS = 950;
/** Fração do voo gasta juntando as cartas num montinho antes de ele sair andando. */
const FRACAO_JUNTANDO = 0.38;
/** Pequeno desalinhamento entre as cartas do montinho, para parecer uma pilha e não uma só carta. */
const DESVIO_DA_PILHA_PX = 2;
const ESCALA_AO_JUNTAR = 0.94;
/** Sem destino (todas se anularam): o montinho encolhe e some. */
const ESCALA_AO_SUMIR = 0.4;
const Z_CARTA_NA_CENA = 45;

type FaseDaCena = 'espera' | 'voo';

interface Cena {
  readonly vaza: VazaResolvida;
  readonly fase: FaseDaCena;
}

export interface AnimacaoDeVaza {
  /** Vaza que ainda está sendo exibida no centro da mesa (`null` fora da animação). */
  readonly vaza: VazaResolvida | null;
  readonly voando: boolean;
  /** Lista que contém os elementos `[data-carta-cena]` a animar. */
  readonly raiz: RefObject<HTMLUListElement>;
}

function chaveDaVaza(vaza: VazaResolvida | null): string | null {
  if (vaza === null) return null;
  return `${vaza.vencedorId ?? '-'}:${vaza.jogadas.map((jogada) => jogada.carta.id).join(',')}`;
}

function prefereMenosMovimento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function centroDe(retangulo: DOMRect): { x: number; y: number } {
  return { x: retangulo.left + retangulo.width / 2, y: retangulo.top + retangulo.height / 2 };
}

function buscarDestino(vencedorId: string | null): HTMLElement | null {
  if (vencedorId === null) return null;
  return document.querySelector<HTMLElement>(`[data-monte-destino="${CSS.escape(vencedorId)}"]`);
}

/**
 * Animação da vaza fechada (FLIP, sem biblioteca): as cartas ficam um instante na mesa, juntam-se
 * num montinho com a vencedora por cima e o montinho voa até o montinho recém-criado de quem
 * ganhou. Detecta a vaza nova comparando os ids das cartas; a primeira vaza vista ao montar a tela
 * (reconexão) não anima.
 */
export function useAnimacaoDeVaza(
  ultimaVaza: VazaResolvida | null,
  mesaVazia: boolean,
): AnimacaoDeVaza {
  const chave = chaveDaVaza(ultimaVaza);
  const [chaveVista, definirChaveVista] = useState(chave);
  const [cena, definirCena] = useState<Cena | null>(null);
  const raiz = useRef<HTMLUListElement>(null);

  // Ajuste durante a renderização: a cena nasce no mesmo render em que o estado novo chega,
  // então o montinho de destino nunca aparece antes da hora.
  if (chave !== chaveVista) {
    definirChaveVista(chave);
    // Mesa já ocupada = a próxima vaza começou rápido; não há onde exibir a cena.
    const animar = ultimaVaza !== null && mesaVazia && !prefereMenosMovimento();
    definirCena(animar ? { vaza: ultimaVaza, fase: 'espera' } : null);
  }

  // Se alguém jogou na vaza seguinte, a cena não cabe mais na mesa: derivada, sem efeito.
  const ativa = cena !== null && mesaVazia ? cena : null;
  const fase = ativa?.fase ?? null;
  const vazaAtiva = ativa?.vaza ?? null;

  useEffect(() => {
    if (fase !== 'espera') return;
    const temporizador = setTimeout(
      () => definirCena((atual) => (atual ? { ...atual, fase: 'voo' } : atual)),
      PAUSA_ANTES_DO_VOO_MS,
    );
    return () => clearTimeout(temporizador);
  }, [fase, vazaAtiva]);

  useEffect(() => {
    if (fase !== 'voo' || vazaAtiva === null) return;
    const encerrar = () => definirCena(null);

    const cartas = Array.from(
      raiz.current?.querySelectorAll<HTMLElement>('[data-carta-cena]') ?? [],
    );
    const origens = cartas.map((elemento) => elemento.getBoundingClientRect());
    const primeira = origens[0];
    if (!primeira || primeira.width === 0) {
      encerrar();
      return;
    }

    const destino = buscarDestino(vazaAtiva.vencedorId)?.getBoundingClientRect() ?? null;
    const esquerda = Math.min(...origens.map((r) => r.left));
    const direita = Math.max(...origens.map((r) => r.right));
    const topo = Math.min(...origens.map((r) => r.top));
    const base = Math.max(...origens.map((r) => r.bottom));
    const centroDoGrupo = centroDe(new DOMRect(esquerda, topo, direita - esquerda, base - topo));

    const animacoes = cartas.map((elemento, indice) => {
      const origem = origens[indice];
      if (!origem) return null;
      const centro = centroDe(origem);
      const ehVencedora = vazaAtiva.jogadas[indice]?.jogadorId === vazaAtiva.vencedorId;
      const desvio = (indice % 3) * DESVIO_DA_PILHA_PX;
      const juntarX = centroDoGrupo.x - centro.x + desvio;
      const juntarY = centroDoGrupo.y - centro.y - desvio;

      elemento.style.zIndex = String(Z_CARTA_NA_CENA + (ehVencedora ? 1 : 0));

      const alvo = destino ? centroDe(destino) : null;
      const escala = destino ? destino.width / origem.width : ESCALA_AO_SUMIR;
      const fimX = alvo ? alvo.x - centro.x : juntarX;
      const fimY = alvo ? alvo.y - centro.y : juntarY;

      return elemento.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
          {
            transform: `translate(${juntarX}px, ${juntarY}px) scale(${ESCALA_AO_JUNTAR})`,
            opacity: 1,
            offset: FRACAO_JUNTANDO,
          },
          {
            transform: `translate(${fimX}px, ${fimY}px) scale(${escala})`,
            opacity: destino ? 1 : 0,
            offset: 1,
          },
        ],
        { duration: DURACAO_DO_VOO_MS, easing: 'ease-in-out', fill: 'forwards' },
      );
    });

    const concluidas = animacoes.flatMap((animacao) => (animacao ? [animacao.finished] : []));
    // Cancelamento (nova vaza ou desmontagem) rejeita `finished`; nesse caso não há o que encerrar.
    void Promise.all(concluidas).then(encerrar, () => undefined);
    return () => animacoes.forEach((animacao) => animacao?.cancel());
  }, [fase, vazaAtiva]);

  return { vaza: vazaAtiva, voando: fase === 'voo', raiz };
}

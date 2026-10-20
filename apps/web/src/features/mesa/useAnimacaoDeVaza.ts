import { useEffect, useRef, useState, type RefObject } from 'react';
import type { VazaResolvida } from '@fodinha/shared';
import {
  DESTINO_DOS_EMPATES,
  MARCADORES,
  prefereMenosMovimento,
  TEMPOS_DA_ANIMACAO,
} from './animacao-compartilhada';
import { centroDe, ESCALONAMENTO_DA_REVELACAO_MS } from './mesa-voos';

/** O servidor limpa a mesa no mesmo estado que fecha a vaza: seguramos as cartas para serem vistas. */
const PAUSA_ANTES_DO_VOO_MS = 800;
/**
 * A última vaza decide o resultado da rodada e jogadores reclamaram que ela sumia rápido demais.
 * As vazas do meio continuam curtas: com bots jogando a cada ~2 s, uma pausa maior seria
 * atropelada pela próxima carta.
 */
const PAUSA_DA_ULTIMA_VAZA_MS = 3000;
/** Na rodada cega as cartas chegam desvirando; todos precisam descobrir a própria carta. */
const LEITURA_DA_REVELACAO_MS = 2500;
const DURACAO_DO_VOO_MS = 950;
/** Fração do voo gasta juntando as cartas num montinho antes de ele sair andando. */
const FRACAO_JUNTANDO = 0.38;
/** Pequeno desalinhamento entre as cartas do montinho, para parecer uma pilha e não uma só carta. */
const DESVIO_DA_PILHA_PX = 2;
const ESCALA_AO_JUNTAR = 0.94;
/** Sem destino na tela (não deveria acontecer): o montinho encolhe e some. */
const ESCALA_AO_SUMIR = 0.4;
const Z_CARTA_NA_CENA = 45;

type FaseDaCena = 'espera' | 'voo';

interface Cena {
  readonly vaza: VazaResolvida;
  readonly fase: FaseDaCena;
  /** Rodada cega: as cartas ainda estão chegando à mesa, então a espera é maior. */
  readonly revelacao: boolean;
  /** Fechou a rodada: fica mais tempo na mesa antes de voar. */
  readonly ultima: boolean;
}

export interface AnimacaoDeVaza {
  /** Vaza que ainda está sendo exibida no centro da mesa (`null` fora da animação). */
  readonly vaza: VazaResolvida | null;
  readonly voando: boolean;
  /** Contêiner das duas linhas, que contém os elementos `[data-carta-mesa]` a animar. */
  readonly raiz: RefObject<HTMLDivElement>;
}

function chaveDaVaza(vaza: VazaResolvida | null): string | null {
  if (vaza === null) return null;
  return `${vaza.vencedorId ?? '-'}:${vaza.jogadas.map((jogada) => jogada.carta.id).join(',')}`;
}

/** Vaza vencida vai para o montinho de quem ganhou; vaza toda anulada, para o canto dos empates. */
function buscarDestino(vencedorId: string | null): HTMLElement | null {
  const destino = vencedorId ?? DESTINO_DOS_EMPATES;
  return document.querySelector<HTMLElement>(`[data-monte-destino="${CSS.escape(destino)}"]`);
}

/**
 * Animação da vaza fechada (FLIP, sem biblioteca): as cartas ficam um instante na mesa, juntam-se
 * num montinho com a vencedora por cima e o montinho voa até o montinho recém-criado de quem
 * ganhou (ou, se todas se anularam, até o canto dos empates na mesa). Detecta a vaza nova comparando os ids das cartas; a primeira vaza vista ao montar a tela
 * (reconexão) não anima.
 */
export function useAnimacaoDeVaza(
  ultimaVaza: VazaResolvida | null,
  mesaVazia: boolean,
  rodadaCega: boolean,
  fimDeRodada: boolean,
): AnimacaoDeVaza {
  const chave = chaveDaVaza(ultimaVaza);
  const [chaveVista, definirChaveVista] = useState(chave);
  const [cena, definirCena] = useState<Cena | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  // Ajuste durante a renderização: a cena nasce no mesmo render em que o estado novo chega,
  // então o montinho de destino nunca aparece antes da hora.
  if (chave !== chaveVista) {
    definirChaveVista(chave);
    // Mesa já ocupada = a próxima vaza começou rápido; não há onde exibir a cena.
    const animar = ultimaVaza !== null && mesaVazia && !prefereMenosMovimento();
    definirCena(
      animar
        ? { vaza: ultimaVaza, fase: 'espera', revelacao: rodadaCega, ultima: fimDeRodada }
        : null,
    );
  }

  // Se alguém jogou na vaza seguinte, a cena não cabe mais na mesa: derivada, sem efeito.
  const ativa = cena !== null && mesaVazia ? cena : null;
  const fase = ativa?.fase ?? null;
  const vazaAtiva = ativa?.vaza ?? null;
  const revelacao = ativa?.revelacao ?? false;
  const ultima = ativa?.ultima ?? false;

  useEffect(() => {
    if (fase !== 'espera') return;
    const cartasReveladas = vazaAtiva?.jogadas.length ?? 0;
    const tempoDeChegada = revelacao
      ? TEMPOS_DA_ANIMACAO.vooDaCartaMs +
        Math.max(cartasReveladas - 1, 0) * ESCALONAMENTO_DA_REVELACAO_MS +
        LEITURA_DA_REVELACAO_MS
      : 0;
    const temporizador = setTimeout(
      () => definirCena((atual) => (atual ? { ...atual, fase: 'voo' } : atual)),
      (ultima ? PAUSA_DA_ULTIMA_VAZA_MS : PAUSA_ANTES_DO_VOO_MS) + tempoDeChegada,
    );
    return () => clearTimeout(temporizador);
  }, [fase, vazaAtiva, revelacao, ultima]);

  useEffect(() => {
    if (fase !== 'voo' || vazaAtiva === null) return;
    const encerrar = () => definirCena(null);

    const cartas = Array.from(
      raiz.current?.querySelectorAll<HTMLElement>(`[${MARCADORES.cartaNaMesa}]`) ?? [],
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
      // A ordem no DOM é "linha de cima, linha de baixo": a dona da carta vem do id, não do índice.
      const idDaCarta = elemento.getAttribute(MARCADORES.cartaNaMesa);
      const dona = vazaAtiva.jogadas.find((jogada) => jogada.carta.id === idDaCarta);
      const ehVencedora = dona !== undefined && dona.jogadorId === vazaAtiva.vencedorId;
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

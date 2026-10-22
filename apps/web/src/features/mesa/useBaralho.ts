import { useLayoutEffect, useState, type RefObject } from 'react';
import type { EstadoPartidaVisivel } from '@fodinha/shared';
import {
  MARCADORES,
  prefereMenosMovimento,
  seletor,
  TEMPOS_DA_ANIMACAO,
} from './animacao-compartilhada';
import { centroDe, criarVersoSolto } from './mesa-voos';
import {
  atrasoNaEntregaMs,
  esperaAteAViraMs,
  estaNaAberturaDaPartida,
  planejarBaralho,
  type Entrega,
} from './planoDoBaralho';

/** O baralho só ganha destaque (maior e com brilho) enquanto embaralha e distribui. */
const CLASSE_BARALHO_EM_CENA = 'baralho--em-cena';
const ESCALA_AO_CHEGAR = 0.55;
const FRACAO_ANTES_DE_SUMIR = 0.85;
/** Quanto as metades do monte se afastam ao embaralhar, em frações da largura da carta. */
const AFASTAMENTO_DO_CORTE = 0.7;
const INCLINACAO_DO_CORTE_GRAUS = 8;

interface Entrada {
  readonly jogo: EstadoPartidaVisivel | null;
  readonly meuId: string | null;
  readonly recebidoEm: number;
  readonly vira: RefObject<HTMLElement | null>;
}

/** Rodada que acabou de chegar, com o retrato do que o planejador precisa para decidir. */
interface Pedido {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string | null;
  readonly recebidoEm: number;
  readonly primeiraVez: boolean;
}

interface Estado {
  readonly rodada: number | null;
  readonly pedido: Pedido | null;
}

/**
 * Partida recém-aberta: a mão e o baralho animam juntos a 1ª distribuição. Lê o relógio de quem
 * chama: existe só para a `TelaMesa` decidir o `animarAoMontar` da mão; o resto usa a regra pura
 * `estaNaAberturaDaPartida`, que recebe o instante.
 */
export function aberturaDaPartida(jogo: EstadoPartidaVisivel, recebidoEm: number): boolean {
  return estaNaAberturaDaPartida(jogo, recebidoEm, Date.now());
}

function embaralhar(baralho: HTMLElement): Animation[] {
  const cartas = Array.from(baralho.querySelectorAll<HTMLElement>('.baralho__carta'));
  // offsetWidth ignora a escala de destaque do baralho: o deslocamento já é multiplicado por ela.
  const largura = baralho.offsetWidth;
  return cartas.map((carta, indice) => {
    // Metade do monte vai para cada lado e volta cruzada: o "corte" do embaralhar.
    const lado = indice % 2 === 0 ? 1 : -1;
    const afastamento = lado * largura * AFASTAMENTO_DO_CORTE;
    const inclinacao = lado * INCLINACAO_DO_CORTE_GRAUS;
    return carta.animate(
      [
        { transform: 'none', offset: 0 },
        { transform: `translateX(${afastamento}px) rotate(${inclinacao}deg)`, offset: 0.35 },
        {
          transform: `translateX(${afastamento * 0.2}px) rotate(${-inclinacao / 2}deg)`,
          offset: 0.7,
        },
        { transform: 'none', offset: 1 },
      ],
      { duration: TEMPOS_DA_ANIMACAO.embaralharMs, easing: 'ease-in-out' },
    );
  });
}

function distribuir(baralho: DOMRect, entrega: Entrega, clones: HTMLElement[]): Animation[] {
  const animacoes: Animation[] = [];
  entrega.forEach((jogadorId, posicao) => {
    // As minhas cartas são animadas pela mão; aqui só ocupam o seu turno no ritmo da mesa.
    if (jogadorId === null) return;
    const placa = document.querySelector<HTMLElement>(
      seletor(MARCADORES.placaDoJogador, jogadorId),
    );
    const clone = criarVersoSolto(baralho);
    if (!placa || !clone) {
      clone?.remove();
      return;
    }
    clones.push(clone);
    // Oculto até a vez dele; o keyframe inicial (opacity 1) o revela quando o voo começa.
    clone.style.opacity = '0';
    const de = centroDe(baralho);
    const para = centroDe(placa.getBoundingClientRect());
    const alvo = `translate(${para.x - de.x}px, ${para.y - de.y}px) scale(${ESCALA_AO_CHEGAR})`;
    const animacao = clone.animate(
      [
        { transform: 'none', opacity: 1, offset: 0 },
        { transform: alvo, opacity: 1, offset: FRACAO_ANTES_DE_SUMIR },
        { transform: alvo, opacity: 0, offset: 1 },
      ],
      {
        duration: TEMPOS_DA_ANIMACAO.vooDaCartaMs,
        delay: atrasoNaEntregaMs(posicao),
        easing: 'ease-in-out',
        fill: 'forwards',
      },
    );
    animacoes.push(animacao);
  });
  return animacoes;
}

function revelarVira(vira: HTMLElement, baralho: DOMRect): void {
  vira.style.opacity = '';
  const de = centroDe(baralho);
  const para = centroDe(vira.getBoundingClientRect());
  vira.animate(
    [
      { transform: `translate(${de.x - para.x}px, ${de.y - para.y}px) scaleX(0)`, opacity: 1 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: TEMPOS_DA_ANIMACAO.vooDaCartaMs, easing: 'ease-out' },
  );
}

/** Executa embaralhar → distribuir → virar a vira; devolve a função que cancela tudo. */
function iniciarEntrega(baralhoEl: HTMLElement, vira: HTMLElement, entrega: Entrega): () => void {
  const clones: HTMLElement[] = [];
  const animacoes: Animation[] = [];
  const cancelamentos: (() => void)[] = [];
  let cancelado = false;
  // A vira some até ser "virada" do baralho; ocultar aqui (antes da pintura) evita um lampejo.
  vira.style.opacity = '0';
  baralhoEl.classList.add(CLASSE_BARALHO_EM_CENA);

  const corte = embaralhar(baralhoEl);
  animacoes.push(...corte);

  void Promise.all(corte.map((animacao) => animacao.finished))
    .then(() => {
      if (cancelado) return undefined;
      const retangulo = baralhoEl.getBoundingClientRect();
      const voos = distribuir(retangulo, entrega, clones);
      animacoes.push(...voos);
      return new Promise<DOMRect>((resolver) => {
        const temporizador = setTimeout(() => resolver(retangulo), esperaAteAViraMs(entrega));
        cancelamentos.push(() => clearTimeout(temporizador));
      });
    })
    .then((retangulo) => {
      if (cancelado || !retangulo) return;
      revelarVira(vira, retangulo);
      clones.forEach((clone) => clone.remove());
      baralhoEl.classList.remove(CLASSE_BARALHO_EM_CENA);
    })
    // Cancelar rejeita `finished`; é o caminho normal de desmontagem.
    .catch(() => undefined);

  return () => {
    cancelado = true;
    animacoes.forEach((animacao) => animacao.cancel());
    cancelamentos.forEach((cancelar) => cancelar());
    clones.forEach((clone) => clone.remove());
    vira.style.opacity = '';
    baralhoEl.classList.remove(CLASSE_BARALHO_EM_CENA);
  };
}

/**
 * Anima a distribuição quando `numeroRodada` muda (e na abertura da partida): o monte embaralha,
 * as cartas voam do baralho até a placa de cada adversário e por fim a vira "vira". A mão do
 * jogador é animada por `Mao.tsx`, no mesmo ritmo (`TEMPOS_DA_ANIMACAO`).
 */
export function useBaralho({ jogo, meuId, recebidoEm, vira }: Entrada): void {
  const numeroRodada = jogo?.numeroRodada ?? null;
  const [estado, definirEstado] = useState<Estado>({ rodada: null, pedido: null });

  // Ajuste durante a renderização (sem relógio): só registra que a rodada mudou. A decisão, que
  // depende do instante, fica no efeito, que roda no mesmo commit e antes da pintura.
  if (jogo !== null && estado.rodada !== numeroRodada) {
    definirEstado({
      rodada: numeroRodada,
      pedido: { jogo, meuId, recebidoEm, primeiraVez: estado.rodada === null },
    });
  }

  const pedido = estado.pedido;
  useLayoutEffect(() => {
    if (pedido === null) return;
    const entrega = planejarBaralho({
      ...pedido,
      agora: Date.now(),
      menosMovimento: prefereMenosMovimento(),
    });
    if (entrega === null) return;
    const baralho = document.querySelector<HTMLElement>(seletor(MARCADORES.baralho));
    const viraEl = vira.current;
    if (!baralho || !viraEl) return;
    return iniciarEntrega(baralho, viraEl, entrega);
  }, [pedido, vira]);
}

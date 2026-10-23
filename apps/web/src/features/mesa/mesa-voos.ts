import { MARCADORES, seletor, TEMPOS_DA_ANIMACAO } from './animacao-compartilhada';

/** Acima da mesa, da mão e das placas, para o voo nunca passar por baixo de outra coisa. */
export const Z_INDEX_DO_VOO = 60;
/** A carta que sai da placa do adversário parte menor do que chega: a placa é pequena. */
const ESCALA_NA_PLACA = 0.6;
/** Reacomodar uma carta que mudou de linha ou de posição (ex.: passou a empatar). */
export const DURACAO_REORGANIZAR_MS = 260;

export interface Deslocamento {
  readonly x: number;
  readonly y: number;
  readonly escala: number;
}

export function centroDe(retangulo: DOMRect): { x: number; y: number } {
  return { x: retangulo.left + retangulo.width / 2, y: retangulo.top + retangulo.height / 2 };
}

/** Quanto mover/escalar um elemento que já está em `destino` para parecer que está em `origem`. */
export function deslocamentoEntre(origem: DOMRect, destino: DOMRect): Deslocamento {
  const o = centroDe(origem);
  const d = centroDe(destino);
  return { x: o.x - d.x, y: o.y - d.y, escala: origem.width / destino.width };
}

export function transformacaoDe({ x, y, escala }: Deslocamento, fracao = 1): string {
  const escalaAtual = 1 + (escala - 1) * fracao;
  return `translate(${x * fracao}px, ${y * fracao}px) scale(${escalaAtual})`;
}

/** Retângulo (do tamanho de uma carta pequena) centrado na placa do jogador. */
export function origemNaPlaca(jogadorId: string, tamanhoNaMesa: DOMRect): DOMRect | null {
  const placa = document.querySelector<HTMLElement>(seletor(MARCADORES.placaDoJogador, jogadorId));
  if (!placa) return null;
  const centro = centroDe(placa.getBoundingClientRect());
  const largura = tamanhoNaMesa.width * ESCALA_NA_PLACA;
  const altura = tamanhoNaMesa.height * ESCALA_NA_PLACA;
  return new DOMRect(centro.x - largura / 2, centro.y - altura / 2, largura, altura);
}

/** Sem origem registrada pela mão (ex.: rodada cega), a carta parte da área da mão. */
export function origemNaMao(tamanhoNaMesa: DOMRect): DOMRect | null {
  const alvo =
    document.querySelector<HTMLElement>(seletor(MARCADORES.cartaNaMao)) ??
    document.querySelector<HTMLElement>('.mao');
  if (!alvo) return null;
  const centro = centroDe(alvo.getBoundingClientRect());
  return new DOMRect(
    centro.x - tamanhoNaMesa.width / 2,
    centro.y - tamanhoNaMesa.height / 2,
    tamanhoNaMesa.width,
    tamanhoNaMesa.height,
  );
}

/** Cópia solta (position: fixed) do verso do baralho, posicionada sobre `retangulo`. */
export function criarVersoSolto(retangulo: DOMRect): HTMLElement | null {
  const modelo = document.querySelector(`${seletor(MARCADORES.baralho)} .carta`);
  if (!modelo) return null;
  const clone = modelo.cloneNode(true);
  if (!(clone instanceof HTMLElement)) return null;
  clone.removeAttribute('role');
  clone.removeAttribute('aria-label');
  clone.setAttribute('aria-hidden', 'true');
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${retangulo.left}px`,
    top: `${retangulo.top}px`,
    margin: '0',
    pointerEvents: 'none',
    zIndex: String(Z_INDEX_DO_VOO),
    transition: 'none',
  });
  clone.style.setProperty('--l-carta', `${retangulo.width}px`);
  document.body.appendChild(clone);
  return clone;
}

interface OpcoesDoVoo {
  readonly origem: DOMRect;
  readonly atrasoMs: number;
  /** Verso → face durante o voo (adversários e rodada cega). */
  readonly desvirar: boolean;
}

/**
 * FLIP: o elemento já está na posição final; animamos "de volta" até a origem. Ao desvirar, um
 * verso solto faz o primeiro meio do caminho e a face real aparece no segundo, achatando-se em
 * `scaleX(0)` no meio para parecer que a carta virou.
 */
export function voarAteAMesa(elemento: HTMLElement, { origem, atrasoMs, desvirar }: OpcoesDoVoo) {
  const destino = elemento.getBoundingClientRect();
  if (destino.width === 0) return;
  const desvio = deslocamentoEntre(origem, destino);
  const opcoes: KeyframeAnimationOptions = {
    duration: TEMPOS_DA_ANIMACAO.vooDaCartaMs,
    delay: atrasoMs,
    easing: 'ease-out',
    fill: 'backwards',
  };

  if (!desvirar) {
    elemento.animate([{ transform: transformacaoDe(desvio) }, { transform: 'none' }], opcoes);
    return;
  }

  const meio = transformacaoDe(desvio, 0.5);
  const verso = criarVersoSolto(destino);
  if (verso) {
    verso.style.opacity = '0';
    const animacaoDoVerso = verso.animate(
      [
        { transform: `${transformacaoDe(desvio)} scaleX(1)`, opacity: 1, offset: 0 },
        { transform: `${meio} scaleX(0)`, opacity: 1, offset: 0.5 },
        { transform: `${meio} scaleX(0)`, opacity: 0, offset: 0.51 },
        { transform: 'none', opacity: 0, offset: 1 },
      ],
      { ...opcoes, fill: 'none' },
    );
    const remover = () => verso.remove();
    animacaoDoVerso.addEventListener('finish', remover);
    animacaoDoVerso.addEventListener('cancel', remover);
  }
  elemento.animate(
    [
      { transform: `${transformacaoDe(desvio)} scaleX(0)`, opacity: 0, offset: 0 },
      { transform: `${meio} scaleX(0)`, opacity: 0, offset: 0.5 },
      { transform: `${meio} scaleX(0)`, opacity: 1, offset: 0.51 },
      { transform: 'none', opacity: 1, offset: 1 },
    ],
    opcoes,
  );
}

/** Carta que só trocou de lugar (ex.: passou para a linha das anuladas). */
export function reacomodar(elemento: HTMLElement, anterior: DOMRect, atual: DOMRect): void {
  const x = anterior.left - atual.left;
  const y = anterior.top - atual.top;
  if (Math.abs(x) < 1 && Math.abs(y) < 1) return;
  elemento.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }], {
    duration: DURACAO_REORGANIZAR_MS,
    easing: 'ease-out',
  });
}

/** Fração do voo gasta juntando as cartas num montinho antes de ele sair andando. */
const FRACAO_JUNTANDO = 0.38;
/** Pequeno desalinhamento entre as cartas do montinho, para parecer uma pilha e não uma só carta. */
const DESVIO_DA_PILHA_PX = 2;
const ESCALA_AO_JUNTAR = 0.94;
/** Sem destino na tela (não deveria acontecer): o montinho encolhe e some. */
const ESCALA_AO_SUMIR = 0.4;
const Z_CARTA_NA_CENA = 45;

/** As cartas exibidas nas linhas da mesa, na ordem do DOM ("linha de cima, linha de baixo"). */
export function cartasDaMesa(raiz: HTMLElement | null): HTMLElement[] {
  return Array.from(raiz?.querySelectorAll<HTMLElement>(seletor(MARCADORES.cartaNaMesa)) ?? []);
}

/** O montinho (ou "Fez", ou monte dos empates) onde a vaza pousa; ver `destinoDaVaza`. */
export function buscarDestinoDoMonte(destino: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(seletor(MARCADORES.monteDestino, destino));
}

interface VooDaVaza {
  /** Cartas da vaza na mesa (`cartasDaMesa`). */
  readonly cartas: readonly HTMLElement[];
  /** Id da carta que ganhou, para ela ficar por cima do montinho. */
  readonly cartaVencedoraId: string | null;
  readonly destino: HTMLElement | null;
  readonly duracaoMs: number;
}

/**
 * FLIP da vaza fechada: as cartas juntam-se num montinho (a vencedora por cima) e o montinho voa
 * até `destino`. Devolve as animações, ou `null` quando não há cartas medíveis na tela.
 */
export function voarVazaAoMonte({
  cartas,
  cartaVencedoraId,
  destino,
  duracaoMs,
}: VooDaVaza): Animation[] | null {
  const origens = cartas.map((elemento) => elemento.getBoundingClientRect());
  const primeira = origens[0];
  if (!primeira || primeira.width === 0) return null;

  const alvo = destino?.getBoundingClientRect() ?? null;
  const esquerda = Math.min(...origens.map((r) => r.left));
  const direita = Math.max(...origens.map((r) => r.right));
  const topo = Math.min(...origens.map((r) => r.top));
  const base = Math.max(...origens.map((r) => r.bottom));
  const centroDoGrupo = centroDe(new DOMRect(esquerda, topo, direita - esquerda, base - topo));

  return cartas.flatMap((elemento, indice) => {
    const origem = origens[indice];
    if (!origem) return [];
    const centro = centroDe(origem);
    const ehVencedora =
      cartaVencedoraId !== null &&
      elemento.getAttribute(MARCADORES.cartaNaMesa) === cartaVencedoraId;
    const desvio = (indice % 3) * DESVIO_DA_PILHA_PX;
    const juntarX = centroDoGrupo.x - centro.x + desvio;
    const juntarY = centroDoGrupo.y - centro.y - desvio;

    elemento.style.zIndex = String(Z_CARTA_NA_CENA + (ehVencedora ? 1 : 0));

    const centroDoAlvo = alvo ? centroDe(alvo) : null;
    const escala = alvo ? alvo.width / origem.width : ESCALA_AO_SUMIR;
    const fimX = centroDoAlvo ? centroDoAlvo.x - centro.x : juntarX;
    const fimY = centroDoAlvo ? centroDoAlvo.y - centro.y : juntarY;

    return [
      elemento.animate(
        [
          { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0 },
          {
            transform: `translate(${juntarX}px, ${juntarY}px) scale(${ESCALA_AO_JUNTAR})`,
            opacity: 1,
            offset: FRACAO_JUNTANDO,
          },
          {
            transform: `translate(${fimX}px, ${fimY}px) scale(${escala})`,
            opacity: alvo ? 1 : 0,
            offset: 1,
          },
        ],
        { duration: duracaoMs, easing: 'ease-in-out', fill: 'forwards' },
      ),
    ];
  });
}

import type { MouseEvent } from 'react';
import { ehCartaOculta, type CartaNaMao, type Naipe, type Valor } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { caminhoDoNaipe, caminhoDoTexto } from './pixel';
import './carta.css';

export type EstadoCarta = 'normal' | 'selecionada' | 'apagada';

const NOME_DO_VALOR: Readonly<Record<Valor, string>> = {
  '4': 'Quatro',
  '5': 'Cinco',
  '6': 'Seis',
  '7': 'Sete',
  '8': 'Oito',
  '9': 'Nove',
  '10': 'Dez',
  Q: 'Dama',
  J: 'Valete',
  K: 'Rei',
  A: 'Ás',
  '2': 'Dois',
  '3': 'Três',
};

const NAIPE_VERMELHO: Readonly<Record<Naipe, boolean>> = {
  ouros: true,
  copas: true,
  espadas: false,
  paus: false,
};

/** Texto lido por leitores de tela, ex.: "Rei de paus, manilha". */
export function descreverCarta(carta: CartaNaMao | null, manilha: Valor | null): string {
  if (carta === null || ehCartaOculta(carta)) return 'Carta virada';
  const base = `${NOME_DO_VALOR[carta.valor]} de ${carta.naipe}`;
  return manilha !== null && carta.valor === manilha ? `${base}, manilha` : base;
}

const VIEWBOX_VALOR = '0 0 11 7';
const VIEWBOX_NAIPE = '0 0 9 9';
const VIEWBOX_F = '0 0 5 7';

interface Props {
  /** `null` ou carta oculta desenham o verso (carta virada). */
  readonly carta: CartaNaMao | null;
  /** Valor da manilha da rodada: cartas com ele ganham o efeito holográfico. */
  readonly manilha?: Valor | null;
  /** Largura em px; a altura segue a proporção do baralho e tudo dentro escala junto. */
  readonly largura?: number;
  /** Valor menor, para cartas muito sobrepostas (o naipe continua visível no canto). */
  readonly densa?: boolean;
  readonly estado?: EstadoCarta;
  /** Inclinação (graus) das cartas jogadas na mesa. */
  readonly inclinacao?: number;
  /** Com `onClick` a carta vira um botão; sem ele, uma imagem com rótulo. */
  readonly onClick?: (evento: MouseEvent<HTMLButtonElement>) => void;
  readonly pressionada?: boolean;
  /** Atributos `data-*` de marcação (ex.: ponto de origem dos voos de animação). */
  readonly atributosDeDados?: Readonly<Record<`data-${string}`, string>>;
  /** Prefixo do rótulo acessível (ex.: "Vira", "Testa de Bia"). */
  readonly rotulo?: string;
}

export function Carta({
  carta,
  manilha = null,
  largura,
  densa = false,
  estado = 'normal',
  inclinacao,
  onClick,
  pressionada,
  atributosDeDados,
  rotulo,
}: Props) {
  const virada = carta === null || ehCartaOculta(carta);
  const ehManilha = !virada && manilha !== null && carta.valor === manilha;
  const descricao = descreverCarta(carta, manilha);
  const textoAcessivel = rotulo ? `${rotulo}: ${descricao}` : descricao;

  const estilo: EstiloComVariaveis = {
    '--l-carta': largura !== undefined ? `${largura}px` : undefined,
    '--inclinacao': inclinacao !== undefined ? `${inclinacao}deg` : undefined,
  };

  const nomeDaClasse = classes(
    'carta',
    virada && 'carta--verso',
    !virada && NAIPE_VERMELHO[carta.naipe] && 'carta--vermelha',
    ehManilha && 'carta--manilha',
    densa && 'carta--densa',
    inclinacao !== undefined && 'carta--inclinada',
    estado === 'selecionada' && 'carta--selecionada',
    estado === 'apagada' && 'carta--apagada',
    onClick && 'carta--clicavel',
  );

  const face = virada ? (
    <span className="carta__face" aria-hidden="true">
      <span className="carta__neon" />
      <span className="carta__selo">
        <svg viewBox={VIEWBOX_F} shapeRendering="crispEdges">
          <path fill="currentColor" d={caminhoDoTexto('F')} />
        </svg>
      </span>
    </span>
  ) : (
    <span className="carta__face" aria-hidden="true">
      {ehManilha && <span className="carta__holo" />}
      <span className="carta__moldura" />
      <svg className="carta__valor" viewBox={VIEWBOX_VALOR} shapeRendering="crispEdges">
        <path fill="currentColor" d={caminhoDoTexto(carta.valor)} />
      </svg>
      <svg className="carta__naipe" viewBox={VIEWBOX_NAIPE} shapeRendering="crispEdges">
        <path fill="currentColor" d={caminhoDoNaipe(carta.naipe)} />
      </svg>
    </span>
  );

  if (onClick) {
    return (
      <button
        type="button"
        className={nomeDaClasse}
        style={estilo}
        aria-label={textoAcessivel}
        aria-pressed={pressionada}
        onClick={onClick}
        {...atributosDeDados}
      >
        {face}
      </button>
    );
  }

  return (
    <div
      className={nomeDaClasse}
      style={estilo}
      role="img"
      aria-label={textoAcessivel}
      {...atributosDeDados}
    >
      {face}
    </div>
  );
}

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as EventoDeMouse,
} from 'react';
import { ehCartaOculta, type CartaNaMao, type Valor } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { CONSULTA_COMPUTADOR, CONSULTA_TOQUE, useMediaQuery } from '../../lib/useMediaQuery';
import { useDuploToque } from '../../lib/useDuploToque';
import { useAlturaDaJanela } from '../../lib/useAlturaDaJanela';
import { useLargura } from '../../lib/useLargura';
import {
  MARCADORES,
  prefereMenosMovimento,
  registrarOrigemDaJogada,
} from './animacao-compartilhada';
import { Carta } from './Carta';
import { useDicaDoGesto } from './dicaDoGesto';
import { calcularLeque } from './leque';
import { animarDistribuicao } from './mao-animacoes';
import {
  comecaDistribuindo,
  idsDasOcultas,
  mudancaDaMao,
  planejarDistribuicao,
  registrarMao,
  vistaDaMao,
  type RegistroDaMao,
} from './planoDaMao';

const JOGADORES_PADRAO_NA_MESA = 4;
/** Fatia da tela que a mão pode ocupar: nas rodadas longas o resto fica para o feltro e o palpite. */
const FRACAO_DA_TELA_PARA_A_MAO = 0.3;

interface Props {
  /** Já chega ordenada do servidor (mais forte → mais fraca): nunca reordenar aqui. */
  readonly cartas: readonly CartaNaMao[];
  readonly manilha: Valor | null;
  /** Só `true` na minha vez e na fase de jogar; fora disso as cartas ficam inertes. */
  readonly podeJogar: boolean;
  /** Apaga as cartas quando não é a minha vez de jogar (na fase de palpites elas ficam nítidas). */
  readonly apagar: boolean;
  readonly onJogar: (cartaId: string) => void;
  /** Ajuda a detectar rodada nova; sem ela, a detecção usa só os ids das cartas. */
  readonly numeroRodada?: number;
  /** Define o intervalo entre cartas na distribuição (uma carta por jogador, em volta da mesa). */
  readonly jogadoresNaMesa?: number;
  /** Anima a distribuição também na primeira montagem (ao reconectar, deixe `false`). */
  readonly animarAoMontar?: boolean;
}

export function Mao({
  cartas,
  manilha,
  podeJogar,
  apagar,
  onJogar,
  numeroRodada,
  jogadoresNaMesa = JOGADORES_PADRAO_NA_MESA,
  animarAoMontar = false,
}: Props) {
  const computador = useMediaQuery(CONSULTA_COMPUTADOR);
  const toque = useMediaQuery(CONSULTA_TOQUE);
  const dicaDoGesto = useDicaDoGesto('carta');
  const [referencia, largura] = useLargura<HTMLDivElement>();
  const alturaDaJanela = useAlturaDaJanela();
  const lequeRef = useRef<HTMLUListElement>(null);
  const itensRef = useRef(new Map<string, HTMLLIElement>());
  const [selecionadaId, definirSelecionadaId] = useState<string | null>(null);
  // `jogar` é declaração de função (içada): pode ser usada aqui, antes de aparecer no corpo.
  const toqueNaCarta = useDuploToque<string>(definirSelecionadaId, (id, evento) =>
    jogar(id, evento.currentTarget),
  );

  const [comecaAnimando] = useState(() =>
    comecaDistribuindo({
      animarAoMontar,
      quantidade: cartas.length,
      menosMovimento: prefereMenosMovimento(),
    }),
  );
  const [registro, definirRegistro] = useState<RegistroDaMao>(() =>
    registrarMao(cartas, numeroRodada),
  );
  const [chegando, definirChegando] = useState(comecaAnimando);
  const [lote, definirLote] = useState(comecaAnimando ? 1 : 0);

  // Mão nova refaz a distribuição. Decidido na renderização para o verso já existir no DOM antes
  // da pintura.
  const registroAtual = registrarMao(cartas, numeroRodada);
  const mudanca = mudancaDaMao(registro, registroAtual);
  if (mudanca !== 'nenhuma') {
    definirRegistro(registroAtual);
    if (mudanca === 'maoNova' && !prefereMenosMovimento()) {
      definirChegando(true);
      definirLote((atual) => atual + 1);
    }
  }

  const alturaMaxima = alturaDaJanela > 0 ? alturaDaJanela * FRACAO_DA_TELA_PARA_A_MAO : undefined;
  const layout = useMemo(
    () =>
      calcularLeque({
        quantidade: cartas.length,
        larguraDisponivel: largura,
        computador,
        alturaMaxima,
      }),
    [cartas.length, largura, computador, alturaMaxima],
  );

  // Os efeitos de animação leem sempre o dado mais recente sem precisar re-executar.
  const dadosRef = useRef({ cartas, layout, jogadoresNaMesa });
  useLayoutEffect(() => {
    dadosRef.current = { cartas, layout, jogadoresNaMesa };
  });

  useLayoutEffect(() => {
    if (lote === 0) return;
    const { cartas: atuais, layout: leiaute, jogadoresNaMesa: jogadores } = dadosRef.current;
    const itens = atuais.map((carta) => itensRef.current.get(carta.id));
    const leque = lequeRef.current;
    if (leque === null || itens.some((item) => item === undefined)) {
      definirChegando(false);
      return;
    }
    let cancelado = false;
    const voos = planejarDistribuicao({
      ocultas: atuais.map(ehCartaOculta),
      jogadoresNaMesa: jogadores,
      sortear: Math.random,
    });
    const animacao = animarDistribuicao({
      itens: itens.filter((item): item is HTMLLIElement => item !== undefined),
      voos,
      leque,
      layout: leiaute,
    });
    void animacao.terminou.then(() => {
      if (cancelado) return;
      animacao.cancelar();
      definirChegando(false);
    });
    return () => {
      cancelado = true;
      animacao.cancelar();
    };
  }, [lote]);

  // Na rodada cega não há fase de jogar: o servidor joga a carta oculta sozinho e ela some da mão.
  // Como não existe clique, a origem do voo é registrada quando a carta sai (ou a mão desmonta),
  // medindo o elemento que ainda está no DOM durante a limpeza do efeito.
  const chaveDasOcultas = idsDasOcultas(cartas).join('|');
  useLayoutEffect(() => {
    if (chaveDasOcultas === '') return;
    const elementos = chaveDasOcultas.split('|').flatMap((id) => {
      const item = itensRef.current.get(id);
      return item ? [{ id, item }] : [];
    });
    return () => {
      for (const { id, item } of elementos) {
        const retangulo = item.getBoundingClientRect();
        if (retangulo.width > 0) registrarOrigemDaJogada(id, retangulo);
      }
    };
  }, [chaveDasOcultas]);

  // A seleção só faz sentido enquanto a carta existe e é a minha vez de jogar.
  useEffect(() => {
    if (selecionadaId === null) return;
    const aindaNaMao = cartas.some((carta) => carta.id === selecionadaId);
    if (!podeJogar || !aindaNaMao) definirSelecionadaId(null);
  }, [cartas, podeJogar, selecionadaId]);

  // Esc cancela a seleção; no toque, tocar fora da mão também.
  useEffect(() => {
    if (selecionadaId === null) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') definirSelecionadaId(null);
    };
    const aoTocar = (evento: PointerEvent) => {
      if (evento.pointerType !== 'touch') return;
      const dentro = evento.target instanceof Node && lequeRef.current?.contains(evento.target);
      if (!dentro) definirSelecionadaId(null);
    };
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('pointerdown', aoTocar);
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.removeEventListener('pointerdown', aoTocar);
    };
  }, [selecionadaId]);

  if (cartas.length === 0) return null;

  const vista = vistaDaMao({
    cartas,
    chegando,
    podeJogar,
    toque,
    destacarDica: dicaDoGesto.destacar,
  });
  const { interativa, ensinandoGesto, dica } = vista;

  function jogar(cartaId: string, elemento: HTMLElement) {
    // A mesa usa este retângulo para animar o voo da mão até o centro.
    registrarOrigemDaJogada(cartaId, elemento.getBoundingClientRect());
    definirSelecionadaId(null);
    dicaDoGesto.aprendeu();
    onJogar(cartaId);
  }

  function aoClicar(cartaId: string, evento: EventoDeMouse<HTMLButtonElement>) {
    if (!interativa) return;
    toqueNaCarta.tocar(cartaId, evento);
  }

  function aoCancelar(evento: EventoDeMouse<HTMLDivElement>) {
    // Botão direito cancela a seleção em vez de abrir o menu do navegador sobre a mão.
    evento.preventDefault();
    toqueNaCarta.esquecer();
    definirSelecionadaId(null);
  }

  return (
    <div className="mao" ref={referencia} onContextMenu={aoCancelar}>
      <p className={classes('mao__dica', ensinandoGesto && 'dica-do-gesto')} aria-live="polite">
        {ensinandoGesto && <strong className="dica-do-gesto__rotulo">Dica</strong>}
        {dica}
      </p>
      <ul
        className="mao__leque"
        ref={lequeRef}
        aria-label="Sua mão"
        style={{ width: layout.larguraTotal, height: layout.alturaTotal }}
      >
        {cartas.map((carta, indice) => {
          const posicao = layout.posicoes[indice];
          if (!posicao) return null;
          const selecionada = selecionadaId === carta.id;
          const comVerso = vista.versos[indice] ?? false;
          const estilo: EstiloComVariaveis = {
            left: posicao.esquerda,
            top: posicao.topo,
            width: layout.larguraCarta,
            transform: `translateY(${posicao.deslocamentoY.toFixed(1)}px) rotate(${posicao.rotacao.toFixed(1)}deg)`,
          };
          return (
            <li
              key={carta.id}
              ref={(no) => {
                if (no) itensRef.current.set(carta.id, no);
                else itensRef.current.delete(carta.id);
              }}
              className={classes('mao__posicao', selecionada && 'mao__posicao--selecionada')}
              style={estilo}
            >
              <Carta
                carta={carta}
                manilha={manilha}
                largura={layout.larguraCarta}
                densa={layout.densa}
                estado={selecionada ? 'selecionada' : apagar ? 'apagada' : 'normal'}
                pressionada={interativa ? selecionada : undefined}
                atributosDeDados={{ [MARCADORES.cartaNaMao]: carta.id }}
                onClick={interativa ? (evento) => aoClicar(carta.id, evento) : undefined}
              />
              {comVerso && (
                <div className="mao__verso" aria-hidden="true">
                  <Carta carta={null} largura={layout.larguraCarta} densa={layout.densa} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {/* Sob as cartas e apagada: orienta sem competir com a mão. Com 1 carta não há ordem. */}
      {vista.mostrarOrdem && (
        <div className="mao__ordem" aria-hidden="true">
          <span>◀ Mais forte</span>
          <span>Mais fraca ▶</span>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  REACOES,
  type EstadoPartidaVisivel,
  type Reacao,
  type ReacaoNaMesa,
} from '@fodinha/shared';
import { reagir } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { useAcao } from '../../lib/useAcao';
import { classes } from '../../lib/classes';
import { useDuploToque } from '../../lib/useDuploToque';
import { somEstaLigado } from '../som/preferencia';
import { tocarReacao } from '../som/sintetizador';
import { verboDeToque } from '../tutorial/ponteiro';
import { MARCADORES, seletor } from './animacao-compartilhada';
import { useDicaDoGesto } from './dicaDoGesto';
import { EmojiAnimado, ehTrevoDourado } from './emojiAnimado';
import { rolarFaixaAtePlaca } from './useSinaisDaVez';
import './reacoes.css';

/** Meu status não é uma placa: a reação aparece sobre a área com meu nome e minhas vidas. */
const ALVO_DA_MINHA_REACAO = '.minha__dados';
/** Folga lateral para o balão não sair da tela quando a placa está na borda. */
const MARGEM_LATERAL_PX = 36;
/** Faixa rolável das placas: quem reage fora dela ganha um aviso na borda. */
const FAIXA_DAS_PLACAS = '.adversarios';
/** Folga do aviso em relação à borda e ao pé da faixa. */
const FOLGA_DO_AVISO_PX = 6;
/** Tempo da rolagem suave até a placa antes de medir de novo e trocar o aviso pelo balão. */
const ESPERA_DA_ROLAGEM_MS = 450;

const chaveDaReacao = (reacao: ReacaoNaMesa) => `${reacao.jogadorId}-${reacao.em}`;

/** Cada reação soa uma única vez, quando chega, por mais que a lista seja redesenhada. */
function useSomDasReacoes(reacoes: readonly ReacaoNaMesa[]): void {
  const tocadas = useRef(new Set<string>());
  useEffect(() => {
    for (const reacao of reacoes) {
      if (tocadas.current.has(chaveDaReacao(reacao)) || !somEstaLigado()) continue;
      tocarReacao(reacao.reacao);
    }
    // Só as vigentes: as que já sumiram da mesa não precisam ser lembradas.
    tocadas.current = new Set(reacoes.map(chaveDaReacao));
  }, [reacoes]);
}

interface PropsBolha {
  readonly reacao: ReacaoNaMesa;
  readonly meuId: string;
  readonly apelido: string;
}

type Posicao =
  | { readonly tipo: 'bolha'; readonly x: number; readonly y: number }
  | {
      readonly tipo: 'aviso';
      readonly lado: 'esquerda' | 'direita';
      readonly y: number;
      readonly borda: number;
    };

/**
 * Balão de emoji sobre o autor. Fica fixo na janela (as placas rolam numa faixa que cortaria
 * um balão que sobe para fora delas). Se a placa do autor está fora da faixa visível, mostra
 * um aviso na borda daquele lado, abaixo da faixa (não cobre placa nem balão); tocar nele rola
 * a faixa até a placa e troca o aviso pelo balão.
 */
function BolhaDeReacao({ reacao, meuId, apelido }: PropsBolha) {
  const [posicao, definirPosicao] = useState<Posicao | null>(null);
  const espera = useRef<number | undefined>(undefined);

  const alvoDaReacao = useCallback(
    () =>
      document.querySelector<HTMLElement>(
        reacao.jogadorId === meuId
          ? ALVO_DA_MINHA_REACAO
          : seletor(MARCADORES.placaDoJogador, reacao.jogadorId),
      ),
    [reacao, meuId],
  );

  const medir = useCallback(() => {
    const alvo = alvoDaReacao();
    if (!alvo) return;
    const caixa = alvo.getBoundingClientRect();
    const centro = caixa.left + caixa.width / 2;
    const faixa = alvo.closest(FAIXA_DAS_PLACAS)?.getBoundingClientRect();
    if (faixa && (centro < faixa.left || centro > faixa.right)) {
      const lado = centro < faixa.left ? 'esquerda' : 'direita';
      const borda = lado === 'esquerda' ? faixa.left : window.innerWidth - faixa.right;
      definirPosicao({ tipo: 'aviso', lado, y: faixa.bottom + FOLGA_DO_AVISO_PX, borda });
      return;
    }
    definirPosicao({
      tipo: 'bolha',
      x: Math.min(Math.max(centro, MARGEM_LATERAL_PX), window.innerWidth - MARGEM_LATERAL_PX),
      y: caixa.top,
    });
  }, [alvoDaReacao]);

  useLayoutEffect(medir, [medir]);
  useEffect(() => () => window.clearTimeout(espera.current), []);

  const irAtePlaca = () => {
    const alvo = alvoDaReacao();
    const faixa = alvo?.closest<HTMLElement>(FAIXA_DAS_PLACAS);
    if (!alvo || !faixa) return;
    rolarFaixaAtePlaca(faixa, alvo);
    espera.current = window.setTimeout(medir, ESPERA_DA_ROLAGEM_MS);
  };

  if (!posicao) return null;
  const dourado = ehTrevoDourado(reacao);
  if (posicao.tipo === 'aviso') {
    const esquerda = posicao.lado === 'esquerda';
    return (
      <button
        type="button"
        className={`reacao-aviso reacao-aviso--${posicao.lado}`}
        style={{ top: posicao.y, [esquerda ? 'left' : 'right']: posicao.borda + FOLGA_DO_AVISO_PX }}
        aria-label={`${apelido} reagiu com ${reacao.reacao}. Ver`}
        onClick={irAtePlaca}
      >
        {esquerda && <span aria-hidden="true">‹</span>}
        <EmojiAnimado reacao={reacao.reacao} dourado={dourado} />
        <span className="reacao-aviso__nome">{apelido}</span>
        {!esquerda && <span aria-hidden="true">›</span>}
      </button>
    );
  }
  return (
    <span
      className="reacao-bolha"
      style={{ left: posicao.x, top: posicao.y }}
      role="img"
      aria-label={`${apelido}: ${reacao.reacao}`}
    >
      <EmojiAnimado reacao={reacao.reacao} dourado={dourado} />
    </span>
  );
}

interface Props {
  readonly meuId: string;
  readonly jogadores: EstadoPartidaVisivel['jogadores'];
}

/**
 * Botão "😀" + painel de emojis + balões das reações recebidas (inclusive as minhas). No painel,
 * 1 toque mostra a prévia (fica rosa, anima e toca o som) e 2 rápidos no mesmo emoji enviam.
 */
export function ReacoesDaMesa({ meuId, jogadores }: Props) {
  const { reacoes } = useApp();
  const [aberto, definirAberto] = useState(false);
  const dicaDoGesto = useDicaDoGesto('reacao');
  const [selecionada, definirSelecionada] = useState<Reacao | null>(null);
  // Muda a cada toque para remontar o emoji e recomeçar a animação da prévia.
  const [toques, definirToques] = useState(0);
  const [ocupado, executar] = useAcao();
  const raiz = useRef<HTMLDivElement>(null);
  useSomDasReacoes(reacoes);

  useEffect(() => {
    if (!aberto) {
      definirSelecionada(null);
      return;
    }
    const fecharFora = (evento: PointerEvent) => {
      if (evento.target instanceof Node && raiz.current?.contains(evento.target)) return;
      definirAberto(false);
    };
    const fecharComEsc = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') definirAberto(false);
    };
    document.addEventListener('pointerdown', fecharFora);
    document.addEventListener('keydown', fecharComEsc);
    return () => {
      document.removeEventListener('pointerdown', fecharFora);
      document.removeEventListener('keydown', fecharComEsc);
    };
  }, [aberto]);

  const toqueNaReacao = useDuploToque<Reacao>(
    (reacao) => {
      definirSelecionada(reacao);
      definirToques((n) => n + 1);
      if (somEstaLigado()) tocarReacao(reacao);
    },
    (reacao) => {
      definirAberto(false);
      dicaDoGesto.aprendeu();
      void executar(() => reagir(reacao));
    },
  );
  const apelidoDe = (id: string) =>
    id === meuId ? 'Você' : (jogadores.find((j) => j.id === id)?.apelido ?? '');

  return (
    <>
      <div ref={raiz} className="reacoes">
        <button
          type="button"
          className="reacoes__botao"
          aria-label="Reagir com emoji"
          aria-expanded={aberto}
          aria-haspopup="true"
          onClick={() => definirAberto(!aberto)}
        >
          <span aria-hidden="true">😀</span>
        </button>
        {aberto && (
          <div className="reacoes__painel" role="group" aria-label="Escolha uma reação">
            {REACOES.map((reacao) => {
              const escolhida = selecionada === reacao;
              return (
                <button
                  key={reacao}
                  type="button"
                  className="reacoes__opcao"
                  aria-pressed={escolhida}
                  aria-label={`Reagir com ${reacao}`}
                  disabled={ocupado}
                  onClick={(evento) => toqueNaReacao.tocar(reacao, evento)}
                >
                  {escolhida ? <EmojiAnimado key={toques} reacao={reacao} /> : reacao}
                </button>
              );
            })}
            <p className={classes('reacoes__dica', dicaDoGesto.destacar && 'dica-do-gesto')}>
              {dicaDoGesto.destacar && <strong className="dica-do-gesto__rotulo">Dica</strong>}
              {verboDeToque()} 1 vez: prévia · 2 rápidas: envia
            </p>
          </div>
        )}
      </div>
      {reacoes.map((reacao) => (
        <BolhaDeReacao
          key={chaveDaReacao(reacao)}
          reacao={reacao}
          meuId={meuId}
          apelido={apelidoDe(reacao.jogadorId)}
        />
      ))}
    </>
  );
}

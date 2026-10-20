import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { REACOES, type Reacao, type ReacaoNaMesa } from '@fodinha/shared';
import { reagir } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { useAcao } from '../../lib/useAcao';
import { somEstaLigado } from '../som/preferencia';
import { tocarReacao } from '../som/sintetizador';
import { verboDeToque } from '../tutorial/ponteiro';
import { MARCADORES, seletor } from './animacao-compartilhada';
import { useDicaDoGesto } from './dicaDoGesto';
import './reacoes.css';

/** Meu status não é uma placa: a reação aparece sobre a área com meu nome e minhas vidas. */
const ALVO_DA_MINHA_REACAO = '.minha__dados';
/** Folga lateral para o balão não sair da tela quando a placa está na borda. */
const MARGEM_LATERAL_PX = 36;

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
}

interface Posicao {
  readonly x: number;
  readonly y: number;
}

/**
 * Balão de emoji sobre o autor. Fica fixo na janela (as placas rolam numa faixa que cortaria
 * um balão que sobe para fora delas) e mede o alvo uma vez, na hora em que aparece.
 */
function BolhaDeReacao({ reacao, meuId }: PropsBolha) {
  const [posicao, definirPosicao] = useState<Posicao | null>(null);

  useLayoutEffect(() => {
    const alvo = document.querySelector(
      reacao.jogadorId === meuId
        ? ALVO_DA_MINHA_REACAO
        : seletor(MARCADORES.placaDoJogador, reacao.jogadorId),
    );
    if (!alvo) return;
    const caixa = alvo.getBoundingClientRect();
    const centro = caixa.left + caixa.width / 2;
    definirPosicao({
      x: Math.min(Math.max(centro, MARGEM_LATERAL_PX), window.innerWidth - MARGEM_LATERAL_PX),
      y: caixa.top,
    });
  }, [reacao, meuId]);

  if (!posicao) return null;
  return (
    <span
      className="reacao-bolha"
      style={{ left: posicao.x, top: posicao.y }}
      role="img"
      aria-label={`Reação: ${reacao.reacao}`}
    >
      {reacao.reacao}
    </span>
  );
}

/** Botão "😀" + painel de emojis + balões das reações recebidas (inclusive as minhas). */
export function ReacoesDaMesa({ meuId }: { readonly meuId: string }) {
  const { reacoes } = useApp();
  const [aberto, definirAberto] = useState(false);
  const dicaDoGesto = useDicaDoGesto('reacao');
  const [ocupado, executar] = useAcao();
  const raiz = useRef<HTMLDivElement>(null);
  useSomDasReacoes(reacoes);

  useEffect(() => {
    if (!aberto) return;
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

  const escolher = (reacao: Reacao) => {
    definirAberto(false);
    dicaDoGesto.aprendeu();
    void executar(() => reagir(reacao));
  };

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
            {/* Aqui um toque só já envia: diferente da carta e do palpite, vale avisar. */}
            {dicaDoGesto.destacar && (
              <p className="reacoes__dica dica-do-gesto">
                <strong className="dica-do-gesto__rotulo">Dica</strong>
                {verboDeToque()} num emoji: todos na mesa veem
              </p>
            )}
            {REACOES.map((reacao) => (
              <button
                key={reacao}
                type="button"
                className="reacoes__opcao"
                aria-label={`Reagir com ${reacao}`}
                disabled={ocupado}
                onClick={() => escolher(reacao)}
              >
                {reacao}
              </button>
            ))}
          </div>
        )}
      </div>
      {reacoes.map((reacao) => (
        <BolhaDeReacao key={chaveDaReacao(reacao)} reacao={reacao} meuId={meuId} />
      ))}
    </>
  );
}

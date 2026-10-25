import type { CSSProperties } from 'react';
import {
  IconeAnterior,
  IconeFechar,
  IconePausar,
  IconeProximo,
  IconePularRodada,
  IconeRetomar,
} from '../../componentes/Icones';
import { useApp } from '../../estado/armazem';
import { descreverPosicao, progressoDoReplay, proximaPosicao } from './linhaDoTempo';
import {
  alternarPlay,
  encerrarReplay,
  lanceAnterior,
  proximoLance,
  pularParaProximaRodada,
} from './motor';
import './replay.css';

/**
 * Barra fina acima da mesa: a mesa encolhe para caber (nada rola). Os botões são os únicos jeitos
 * de mexer no replay; palpite, cartas e reações ficam recusados pela fonte.
 */
export function ControlesDoReplay() {
  const { fonte } = useApp();
  if (fonte.origem !== 'replay') return null;

  const { rodada, lance, lancesNaRodada, totalDeRodadas, tocando, carregando } = fonte;
  const noInicio = rodada === 1 && lance === 0;
  const noFim = proximaPosicao(fonte, lancesNaRodada, totalDeRodadas) === null;
  const naUltimaRodada = rodada >= totalDeRodadas;
  const posicao = descreverPosicao(fonte, lancesNaRodada, totalDeRodadas);
  const progresso: CSSProperties = {
    width: `${(progressoDoReplay(fonte, lancesNaRodada, totalDeRodadas) * 100).toFixed(1)}%`,
  };

  return (
    <nav className="replay" aria-label="Controles do replay">
      <span className="replay__selo">Replay</span>
      <p className="replay__posicao" role="status" aria-live="polite">
        {carregando ? 'Carregando a rodada…' : posicao}
      </p>
      <div className="replay__botoes">
        <button
          type="button"
          className="botao botao--icone"
          aria-label="Lance anterior"
          title="Lance anterior"
          disabled={noInicio || carregando}
          onClick={() => void lanceAnterior()}
        >
          <IconeAnterior />
        </button>
        <button
          type="button"
          className="botao botao--icone botao--primario"
          aria-label={tocando ? 'Pausar' : noFim ? 'Rever do começo' : 'Tocar'}
          title={tocando ? 'Pausar' : noFim ? 'Rever do começo' : 'Tocar'}
          onClick={alternarPlay}
        >
          {tocando ? <IconePausar /> : <IconeRetomar />}
        </button>
        <button
          type="button"
          className="botao botao--icone"
          aria-label="Próximo lance"
          title="Próximo lance"
          disabled={noFim || carregando}
          onClick={() => void proximoLance()}
        >
          <IconeProximo />
        </button>
        <button
          type="button"
          className="botao botao--icone"
          aria-label="Pular para a próxima rodada"
          title="Pular rodada"
          disabled={naUltimaRodada || carregando}
          onClick={() => void pularParaProximaRodada()}
        >
          <IconePularRodada />
        </button>
        <button
          type="button"
          className="botao botao--icone botao--perigo"
          aria-label="Sair do replay"
          title="Sair do replay"
          onClick={encerrarReplay}
        >
          <IconeFechar />
        </button>
      </div>
      <span className="replay__progresso" aria-hidden="true">
        <span className="replay__progresso-barra" style={progresso} />
      </span>
    </nav>
  );
}

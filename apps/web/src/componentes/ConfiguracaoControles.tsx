import { useId } from 'react';
import { LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import './configuracao.css';

interface Props {
  readonly valor: ConfiguracaoPartida;
  readonly onChange: (configuracao: ConfiguracaoPartida) => void;
  readonly desabilitado?: boolean;
}

interface PassoProps {
  readonly rotulo: string;
  /** Forma curta usada nos rótulos dos botões ("Menos baralhos"). */
  readonly substantivo: string;
  readonly valor: number;
  readonly minimo: number;
  readonly maximo: number;
  readonly desabilitado: boolean;
  readonly onChange: (valor: number) => void;
}

function Passo({ rotulo, substantivo, valor, minimo, maximo, desabilitado, onChange }: PassoProps) {
  const idRotulo = useId();
  return (
    <div className="linha-config">
      <span id={idRotulo}>{rotulo}</span>
      <div className="passo" role="group" aria-labelledby={idRotulo}>
        <button
          type="button"
          className="passo__botao"
          disabled={desabilitado || valor <= minimo}
          onClick={() => onChange(valor - 1)}
          aria-label={`Menos ${substantivo}`}
        >
          −
        </button>
        <output className="passo__valor" aria-live="polite">
          {valor}
        </output>
        <button
          type="button"
          className="passo__botao"
          disabled={desabilitado || valor >= maximo}
          onClick={() => onChange(valor + 1)}
          aria-label={`Mais ${substantivo}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Controles de configuração reaproveitados pela criação de sala e pelo lobby (DRY). */
export function ConfiguracaoControles({ valor, onChange, desabilitado = false }: Props) {
  const idInterruptor = useId();
  const idMortos = useId();
  return (
    <div className="configuracao">
      <Passo
        rotulo="Baralhos"
        substantivo="baralhos"
        valor={valor.quantidadeBaralhos}
        minimo={LIMITES.minBaralhos}
        maximo={LIMITES.maxBaralhos}
        desabilitado={desabilitado}
        onChange={(quantidadeBaralhos) => onChange({ ...valor, quantidadeBaralhos })}
      />
      <Passo
        rotulo="Vidas iniciais"
        substantivo="vidas"
        valor={valor.vidasIniciais}
        minimo={LIMITES.minVidas}
        maximo={LIMITES.maxVidas}
        desabilitado={desabilitado}
        onChange={(vidasIniciais) => onChange({ ...valor, vidasIniciais })}
      />
      <div className="linha-config">
        <span id={idInterruptor}>Incluir 8, 9 e 10</span>
        <button
          type="button"
          role="switch"
          aria-checked={valor.incluirOitoNoveDez}
          aria-labelledby={idInterruptor}
          className="interruptor"
          disabled={desabilitado}
          onClick={() => onChange({ ...valor, incluirOitoNoveDez: !valor.incluirOitoNoveDez })}
        >
          <span className="interruptor__bola" />
        </button>
      </div>
      <div className="linha-config">
        <span id={idMortos}>Eliminados veem as cartas</span>
        <button
          type="button"
          role="switch"
          aria-checked={valor.mortosVeemCartas}
          aria-labelledby={idMortos}
          className="interruptor"
          disabled={desabilitado}
          onClick={() => onChange({ ...valor, mortosVeemCartas: !valor.mortosVeemCartas })}
        >
          <span className="interruptor__bola" />
        </button>
      </div>
    </div>
  );
}

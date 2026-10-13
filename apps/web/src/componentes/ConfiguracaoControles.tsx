import { LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import './configuracao.css';

interface Props {
  readonly valor: ConfiguracaoPartida;
  readonly onChange: (configuracao: ConfiguracaoPartida) => void;
  readonly desabilitado?: boolean;
}

interface PassoProps {
  readonly rotulo: string;
  readonly valor: number;
  readonly minimo: number;
  readonly maximo: number;
  readonly desabilitado: boolean;
  readonly onChange: (valor: number) => void;
}

function Passo({ rotulo, valor, minimo, maximo, desabilitado, onChange }: PassoProps) {
  return (
    <div className="passo">
      <span className="passo__rotulo" id={`passo-${rotulo}`}>
        {rotulo}
      </span>
      <div className="passo__controle" role="group" aria-labelledby={`passo-${rotulo}`}>
        <button
          type="button"
          className="botao passo__botao"
          disabled={desabilitado || valor <= minimo}
          onClick={() => onChange(valor - 1)}
          aria-label={`Diminuir ${rotulo}`}
        >
          −
        </button>
        <output className="passo__valor">{valor}</output>
        <button
          type="button"
          className="botao passo__botao"
          disabled={desabilitado || valor >= maximo}
          onClick={() => onChange(valor + 1)}
          aria-label={`Aumentar ${rotulo}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Controles de configuração reaproveitados pela criação de sala e pelo lobby (DRY). */
export function ConfiguracaoControles({ valor, onChange, desabilitado = false }: Props) {
  return (
    <div className="configuracao">
      <Passo
        rotulo="Baralhos"
        valor={valor.quantidadeBaralhos}
        minimo={LIMITES.minBaralhos}
        maximo={LIMITES.maxBaralhos}
        desabilitado={desabilitado}
        onChange={(quantidadeBaralhos) => onChange({ ...valor, quantidadeBaralhos })}
      />
      <Passo
        rotulo="Vidas iniciais"
        valor={valor.vidasIniciais}
        minimo={LIMITES.minVidas}
        maximo={LIMITES.maxVidas}
        desabilitado={desabilitado}
        onChange={(vidasIniciais) => onChange({ ...valor, vidasIniciais })}
      />
      <label className="configuracao__marcar">
        <input
          type="checkbox"
          checked={valor.incluirOitoNoveDez}
          disabled={desabilitado}
          onChange={(e) => onChange({ ...valor, incluirOitoNoveDez: e.target.checked })}
        />
        <span>Incluir 8, 9 e 10 no baralho</span>
      </label>
    </div>
  );
}

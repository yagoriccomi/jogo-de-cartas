import { useId, type CSSProperties } from 'react';
import {
  VOLUME_MAXIMO,
  VOLUME_MINIMO,
  definirSomLigado,
  definirVolumeEfeitos,
  definirVolumeMusica,
  definirVolumeReacoes,
  useSomLigado,
  useVolumeEfeitos,
  useVolumeMusica,
  useVolumeReacoes,
} from './preferencia';
import './som.css';

/** Passo do teclado (setas) nos controles de volume. */
const PASSO_DO_VOLUME = 5;

interface PropsVolume {
  readonly rotulo: string;
  readonly valor: number;
  readonly desativado: boolean;
  readonly onMudar: (valor: number) => void;
}

function ControleDeVolume({ rotulo, valor, desativado, onMudar }: PropsVolume) {
  const id = useId();
  return (
    <div className="volume">
      <label htmlFor={id} className="volume__rotulo">
        {rotulo}
      </label>
      <input
        id={id}
        className="volume__barra"
        type="range"
        min={VOLUME_MINIMO}
        max={VOLUME_MAXIMO}
        step={PASSO_DO_VOLUME}
        value={valor}
        disabled={desativado}
        aria-valuetext={`${valor}%`}
        // A barra preenchida até o valor vem do CSS, que não lê o valor do range sozinho.
        style={{ '--volume': `${valor}%` } as CSSProperties}
        onChange={(evento) => onMudar(Number(evento.target.value))}
      />
      <span className="volume__valor" aria-hidden="true">
        {valor}%
      </span>
    </div>
  );
}

/** Bloco do menu lateral: o mudo geral (som, música e vibração) e os volumes de cada canal. */
export function OpcaoSom() {
  const ligado = useSomLigado();
  const volumeMusica = useVolumeMusica();
  const volumeEfeitos = useVolumeEfeitos();
  const volumeReacoes = useVolumeReacoes();
  return (
    <div className="opcao-som">
      <button
        type="button"
        className="menu__item"
        role="switch"
        aria-checked={ligado}
        onClick={() => definirSomLigado(!ligado)}
      >
        <svg
          className="icone"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M4 9v6h4l5 4V5L8 9z" />
          {ligado ? (
            <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" />
          ) : (
            <path d="M17 9l5 6M22 9l-5 6" />
          )}
        </svg>
        <span className="menu__texto">Som e vibração</span>
        <span className="menu__seta">{ligado ? 'Ligado' : 'Desligado'}</span>
      </button>
      {/* Com o mudo ligado os volumes ficam guardados, mas não dá para mexer até religar. */}
      <ControleDeVolume
        rotulo="Música"
        valor={volumeMusica}
        desativado={!ligado}
        onMudar={definirVolumeMusica}
      />
      <ControleDeVolume
        rotulo="Efeitos"
        valor={volumeEfeitos}
        desativado={!ligado}
        onMudar={definirVolumeEfeitos}
      />
      <ControleDeVolume
        rotulo="Reações"
        valor={volumeReacoes}
        desativado={!ligado}
        onMudar={definirVolumeReacoes}
      />
    </div>
  );
}

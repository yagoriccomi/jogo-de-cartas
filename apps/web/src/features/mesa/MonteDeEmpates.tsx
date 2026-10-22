import type { Valor, VazaEmpatada } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { DESTINO_DOS_EMPATES, MARCADORES } from './animacao-compartilhada';
import { Carta } from './Carta';

/** Folhas atrás da carta do topo: sugerem a pilha sem desenhar cada vaza. */
const CAMADAS_MAXIMAS = 3;

interface Props {
  readonly vazas: readonly VazaEmpatada[];
  readonly manilha: Valor | null;
  /** Vazas à vista (`contagemVisivel`): a que ainda voa para cá só conta ao pousar. */
  readonly visiveis: number;
}

/**
 * Vazas em que tudo se anulou, num único monte abaixo da manilha (dentro do feltro): a carta mais
 * recente por cima e o total ao lado. No celular só o contador aparece, para não roubar espaço.
 */
export function MonteDeEmpates({ vazas, manilha, visiveis }: Props) {
  if (vazas.length === 0) return null;
  const topo = visiveis > 0 ? vazas[visiveis - 1] : undefined;
  const camadas = Math.min(Math.max(visiveis - 1, 0), CAMADAS_MAXIMAS);

  return (
    <div
      className={classes('empates', topo === undefined && 'empates--chegando')}
      // O destino do voo continua na tela mesmo enquanto o primeiro monte ainda não chegou.
      {...{ [MARCADORES.monteDestino]: DESTINO_DOS_EMPATES }}
      aria-label={`Vazas empatadas: ${visiveis}`}
      title="Vazas em que todas as cartas se anularam"
    >
      <span className="rotulo-pequeno feltro__rotulo">Empates</span>
      <div className="empates__corpo">
        {topo && (
          <div className="empates__monte" aria-hidden="true">
            {Array.from({ length: camadas }, (_, camada) => {
              const estilo: EstiloComVariaveis = { '--camada': camada + 1 };
              return <span key={camada} className="monte__camada" style={estilo} />;
            })}
            <Carta carta={topo.cartaDoTopo} manilha={manilha} densa rotulo="Vaza empatada" />
          </div>
        )}
        <strong className="empates__contagem">×{visiveis}</strong>
      </div>
    </div>
  );
}

import { useState } from 'react';
import type { Carta as DadosDaCarta, Valor } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';

/** Até esta quantidade de opções os botões são grandes e ocupam uma linha. */
const OPCOES_GRANDES = 4;
/** Até esta quantidade cada opção ganha a sua coluna; acima disso a grade fixa em 7 colunas. */
const OPCOES_EM_UMA_LINHA = 7;
const COLUNAS_DA_GRADE_LONGA = 7;

interface Props {
  readonly cartasNaRodada: number;
  readonly palpiteProibido: number | null;
  readonly souOPe: boolean;
  readonly vira: DadosDaCarta | null;
  readonly manilha: Valor | null;
  /** Palpites já dados pelos outros nesta rodada (para a soma). */
  readonly palpitesDosOutros: readonly number[];
  readonly prazoFinal: number | null;
  readonly ocupado: boolean;
  readonly onConfirmar: (quantidade: number) => void;
}

function tamanhoDaGrade(opcoes: number): 'grande' | 'media' | 'pequena' {
  if (opcoes <= OPCOES_GRANDES) return 'grande';
  if (opcoes <= OPCOES_EM_UMA_LINHA) return 'media';
  return 'pequena';
}

export function PainelPalpite({
  cartasNaRodada,
  palpiteProibido,
  souOPe,
  vira,
  manilha,
  palpitesDosOutros,
  prazoFinal,
  ocupado,
  onConfirmar,
}: Props) {
  const [escolhido, definirEscolhido] = useState<number | null>(null);
  const opcoes = Array.from({ length: cartasNaRodada + 1 }, (_, quantidade) => quantidade);
  const soma = palpitesDosOutros.reduce((total, palpite) => total + palpite, 0);
  const colunas = Math.min(opcoes.length, COLUNAS_DA_GRADE_LONGA);
  const estiloGrade: EstiloComVariaveis = { '--colunas': colunas };
  const cartasTexto = cartasNaRodada === 1 ? '1 carta' : `${cartasNaRodada} cartas`;

  return (
    <div className="palpite" role="dialog" aria-labelledby="titulo-palpite">
      <div className="palpite__topo">
        {/* No celular o painel cobre a coluna da vira: ela vem junto, em miniatura. */}
        <div className="palpite__vira so-celular">
          <Carta carta={vira} manilha={manilha} densa rotulo="Vira" />
        </div>
        <div className="palpite__cabeca">
          <h2 id="titulo-palpite" className="neon palpite__titulo">
            Seu palpite
          </h2>
          <span className="palpite__contexto">
            <span className="so-celular">
              Manilha <strong>{manilha ?? '–'}</strong>
            </span>
            {souOPe && <span className="selo selo--pe">Você é o pé</span>}
          </span>
        </div>
        {prazoFinal !== null && <ContagemRegressiva prazoFinal={prazoFinal} className="pilula" />}
      </div>

      <div
        className={classes('palpite__grade', `palpite__grade--${tamanhoDaGrade(opcoes.length)}`)}
        style={estiloGrade}
        role="group"
        aria-label="Quantidade de vazas"
      >
        {opcoes.map((quantidade) => {
          const proibido = quantidade === palpiteProibido;
          return (
            <button
              key={quantidade}
              type="button"
              className={classes('palpite__opcao', proibido && 'palpite__opcao--bloqueada')}
              aria-pressed={escolhido === quantidade}
              aria-label={proibido ? `${quantidade}, bloqueado` : String(quantidade)}
              disabled={proibido || ocupado}
              onClick={() => definirEscolhido(quantidade)}
            >
              {quantidade}
            </button>
          );
        })}
      </div>

      {palpiteProibido !== null && (
        <p className="palpite__bloqueio" role="note">
          O {palpiteProibido} está bloqueado: a soma fecharia nas {cartasTexto}.
          <span className="so-computador"> O pé precisa garantir que alguém erre.</span>
        </p>
      )}

      <div className="palpite__rodape">
        <span className="palpite__soma">
          {palpitesDosOutros.length > 0 ? 'Soma' : 'Você abre'}
          <br />
          <strong>{soma}</strong> de {cartasNaRodada}
        </span>
        <button
          type="button"
          className="botao botao--primario"
          disabled={escolhido === null || ocupado}
          onClick={() => escolhido !== null && onConfirmar(escolhido)}
        >
          {escolhido === null ? 'Escolha' : `Confirmar ${escolhido}`}
        </button>
      </div>
    </div>
  );
}

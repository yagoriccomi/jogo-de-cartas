import { useState } from 'react';
import type { Carta as DadosDaCarta, Valor } from '@fodinha/shared';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';
import { SimbolosMaoEPe } from './SimbolosMaoEPe';

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
  /** Quem já palpitou nesta rodada, na ordem de jogo (a mão primeiro). */
  readonly palpitesAnteriores: readonly PalpiteAnterior[];
  /** Quantos ainda palpitam depois de mim. */
  readonly depoisDeVoce: number;
  readonly prazoFinal: number | null;
  readonly ocupado: boolean;
  readonly onConfirmar: (quantidade: number) => void;
}

export interface PalpiteAnterior {
  readonly id: string;
  readonly nome: string;
  readonly palpite: number;
  readonly ehMao: boolean;
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
  palpitesAnteriores,
  depoisDeVoce,
  prazoFinal,
  ocupado,
  onConfirmar,
}: Props) {
  const [escolhido, definirEscolhido] = useState<number | null>(null);
  const [detalhesAbertos, definirDetalhesAbertos] = useState(false);
  const opcoes = Array.from({ length: cartasNaRodada + 1 }, (_, quantidade) => quantidade);
  const soma = palpitesAnteriores.reduce((total, anterior) => total + anterior.palpite, 0);
  // Vazas ainda "sem dono" nos palpites: negativo quando a mesa já pediu mais do que há.
  const saldo = cartasNaRodada - soma;
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
            Vai fazer quantas?
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
        <div className="palpite__info">
          <p className="palpite__resumo">
            <span>
              <span className="palpite__rodada-de">Rodada de </span>
              <strong>{cartasNaRodada}</strong> {cartasNaRodada === 1 ? 'carta' : 'cartas'}
            </span>
            <span className="palpite__divisor" aria-hidden="true">
              |
            </span>
            <span>
              Saldo:{' '}
              <strong className={classes(saldo < 0 && 'palpite__saldo--negativo')}>{saldo}</strong>
            </span>
          </p>
          <button
            type="button"
            className="palpite__mais"
            aria-expanded={detalhesAbertos}
            aria-controls="palpite-detalhes"
            onClick={() => definirDetalhesAbertos((aberto) => !aberto)}
          >
            {detalhesAbertos ? 'Mostrar menos' : 'Mostrar mais'}
          </button>
        </div>
        <button
          type="button"
          className="botao botao--primario"
          disabled={escolhido === null || ocupado}
          onClick={() => escolhido !== null && onConfirmar(escolhido)}
        >
          {escolhido === null ? 'Escolha' : `Confirmar ${escolhido}`}
        </button>
      </div>

      {/* Abaixo do Confirmar: em telas baixas a lista aberta rola sem esconder o botão. */}
      {detalhesAbertos && (
        <div id="palpite-detalhes" className="palpite__detalhes">
          {palpitesAnteriores.length === 0 ? (
            <p className="palpite__vazio">Você abre a rodada.</p>
          ) : (
            <ol className="palpite__lista" aria-label="Palpites já feitos">
              {palpitesAnteriores.map((anterior) => (
                <li key={anterior.id} className="palpite__item">
                  <span className="palpite__nome">{anterior.nome}</span>
                  <SimbolosMaoEPe ehMao={anterior.ehMao} ehPe={false} />
                  <span className="palpite__faz">
                    → faz <strong>{anterior.palpite}</strong>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {depoisDeVoce > 0 && (
            <p className="palpite__depois">
              Jogadores depois de você <strong>+{depoisDeVoce}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

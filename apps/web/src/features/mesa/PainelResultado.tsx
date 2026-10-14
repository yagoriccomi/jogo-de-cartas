import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { useState } from 'react';
import { Dialogo } from '../../componentes/Dialogo';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { useAgora } from '../../lib/useAgora';

const INTERVALO_BARRA_MS = 100;
const MS_POR_SEGUNDO = 1000;

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
  /** Instante local em que o último estado chegou: `comecaEmMs` é medido a partir dele. */
  readonly recebidoEm: number;
}

/** Folha informativa exibida durante `fim_de_rodada`; o servidor avança sozinho, sem botão. */
export function PainelResultado({ jogo, meuId, recebidoEm }: Props) {
  const agora = useAgora(INTERVALO_BARRA_MS);
  const proxima = jogo.proximaRodada;
  // A barra parte do tempo que o servidor informou quando o painel apareceu; estados reenviados
  // durante a espera só reposicionam o fim, sem mudar a escala da barra.
  const [duracaoTotalMs] = useState(proxima?.comecaEmMs ?? null);
  const resultados = jogo.resultadoRodada;
  if (!resultados) return null;

  const comecaEmMs = proxima?.comecaEmMs ?? null;
  const restanteMs = comecaEmMs === null ? null : Math.max(0, recebidoEm + comecaEmMs - agora);
  const restanteSegundos = restanteMs === null ? null : Math.ceil(restanteMs / MS_POR_SEGUNDO);
  const progresso =
    restanteMs === null || duracaoTotalMs === null || duracaoTotalMs <= 0
      ? 0
      : Math.min(1, Math.max(0, 1 - restanteMs / duracaoTotalMs));
  const estiloBarra: EstiloComVariaveis = { '--progresso': `${progresso * 100}%` };

  const jogadorDe = (id: string) => jogo.jogadores.find((j) => j.id === id);
  const quemAbre = proxima ? jogadorDe(proxima.idDoPrimeiro) : undefined;
  const cartasTexto = jogo.cartasPorJogador === 1 ? '1 carta' : `${jogo.cartasPorJogador} cartas`;

  return (
    <Dialogo idTitulo="titulo-resultado" variante="folha">
      <div className="folha__alca" aria-hidden="true" />
      <div className="folha__cabecalho">
        <h2 id="titulo-resultado" className="neon folha__titulo">
          Fim da rodada {jogo.numeroRodada}
        </h2>
        <span className="folha__cartas">{cartasTexto}</span>
      </div>

      <table className="resultado">
        <thead>
          <tr>
            <th scope="col">Jogador</th>
            <th scope="col">Palpite</th>
            <th scope="col">Fez</th>
            <th scope="col">Vidas</th>
          </tr>
        </thead>
        <tbody>
          {resultados.map((r) => {
            const jogador = jogadorDe(r.jogadorId);
            const perdeu = r.vidasPerdidas > 0;
            return (
              <tr key={r.jogadorId} className={classes(r.jogadorId === meuId && 'resultado__eu')}>
                <th scope="row">
                  {jogador?.apelido ?? 'Jogador'}
                  {r.jogadorId === meuId && ' (você)'}
                </th>
                <td>{r.palpite}</td>
                <td>{r.vazasFeitas}</td>
                <td className={perdeu ? 'resultado__perdeu' : 'resultado__ok'}>
                  {jogador && `♥${jogador.vidas} `}
                  {perdeu ? `−${r.vidasPerdidas}` : '✓'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {proxima && (
        <div className="folha__proxima">
          <div className="folha__proxima-texto">
            <span>
              Próxima:{' '}
              <strong>
                {proxima.cartasPorJogador === 1 ? '1 carta' : `${proxima.cartasPorJogador} cartas`}
              </strong>
              {quemAbre && (
                <>
                  {' '}
                  · começa <strong>{quemAbre.id === meuId ? 'você' : quemAbre.apelido}</strong>
                </>
              )}
            </span>
            {restanteSegundos !== null && (
              <span className="folha__segundos">{restanteSegundos}s</span>
            )}
          </div>
          {restanteSegundos !== null && (
            <div className="barra-progresso" style={estiloBarra} aria-hidden="true">
              <div className="barra-progresso__preenchido" />
            </div>
          )}
        </div>
      )}
    </Dialogo>
  );
}

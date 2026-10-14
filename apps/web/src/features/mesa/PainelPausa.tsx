import type { EstadoPartidaVisivel, VotacaoEspera } from '@fodinha/shared';
import { Dialogo } from '../../componentes/Dialogo';
import { votarEspera } from '../../estado/acoes';
import { classes } from '../../lib/classes';
import { useAcao } from '../../lib/useAcao';
import { useAgora } from '../../lib/useAgora';
import { formatarDuracao } from './tempo';

const INTERVALO_RELOGIO_MS = 1000;

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
}

interface VotacaoProps {
  readonly votacao: VotacaoEspera;
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
  readonly agora: number;
}

function rotuloDoVoto(esperar: boolean | null): { texto: string; classe: string } {
  if (esperar === null) return { texto: 'aguardando…', classe: 'voto--aguardando' };
  return esperar ? { texto: 'SIM', classe: 'voto--sim' } : { texto: 'NÃO', classe: 'voto--nao' };
}

function Votacao({ votacao, jogo, meuId, agora }: VotacaoProps) {
  const [ocupado, executar] = useAcao();
  const meuVoto = votacao.votos.find((voto) => voto.eleitorId === meuId);
  // O instante vem do relógio do servidor; o cliente só mostra um tempo aproximado (nunca negativo).
  const ausenteHa = formatarDuracao(agora - votacao.desconectadoDesde);
  const nomeDe = (id: string) => jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador';

  return (
    <section className="votacao" aria-label={`Votação sobre ${votacao.apelido}`}>
      <p className="votacao__situacao">
        <strong>{votacao.apelido}</strong> perdeu a conexão há {ausenteHa}.
      </p>

      {meuVoto ? (
        <div className="votacao__pergunta">
          <p id={`pergunta-${votacao.ausenteId}`} className="votacao__titulo">
            Deseja esperar o retorno de {votacao.apelido}?
          </p>
          <div
            className="votacao__botoes"
            role="group"
            aria-labelledby={`pergunta-${votacao.ausenteId}`}
          >
            <button
              type="button"
              className={classes(
                'botao votacao__sim',
                meuVoto.esperar === true && 'votacao--escolhido',
              )}
              aria-pressed={meuVoto.esperar === true}
              disabled={ocupado}
              onClick={() => void executar(() => votarEspera(votacao.ausenteId, true))}
            >
              SIM
            </button>
            <button
              type="button"
              className={classes(
                'botao botao--perigo votacao__nao',
                meuVoto.esperar === false && 'votacao--escolhido',
              )}
              aria-pressed={meuVoto.esperar === false}
              disabled={ocupado}
              onClick={() => void executar(() => votarEspera(votacao.ausenteId, false))}
            >
              NÃO
            </button>
          </div>
        </div>
      ) : (
        <p className="votacao__espera">Aguardando os outros jogadores decidirem…</p>
      )}

      <div className="votacao__votos">
        <span className="rotulo-pequeno">Votos</span>
        <ul>
          {votacao.votos.map((voto) => {
            const rotulo = rotuloDoVoto(voto.esperar);
            return (
              <li key={voto.eleitorId}>
                <span>
                  {nomeDe(voto.eleitorId)}
                  {voto.eleitorId === meuId && ' (você)'}
                </span>
                <span className={classes('voto', rotulo.classe)}>{rotulo.texto}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <p className="votacao__regra">
        Se todos votarem <strong>NÃO</strong>, {votacao.apelido} é eliminado e um bot termina a
        rodada dele. Basta um <strong>SIM</strong> para continuar esperando. Bots não votam.
      </p>
    </section>
  );
}

/** Diálogo bloqueante: a partida fica congelada até a votação sobre quem caiu se resolver. */
export function PainelPausa({ jogo, meuId }: Props) {
  const agora = useAgora(INTERVALO_RELOGIO_MS);
  const votacoes = jogo.pausa?.votacoes ?? [];
  if (votacoes.length === 0) return null;

  return (
    <Dialogo idTitulo="titulo-pausa" papel="alertdialog" destaque="ciano">
      <div className="pausa__cabecalho">
        <span className="pausa__ponto" aria-hidden="true" />
        <h2 id="titulo-pausa" className="neon neon--ciano dialogo__titulo">
          Partida pausada
        </h2>
      </div>
      {votacoes.map((votacao) => (
        <Votacao
          key={votacao.ausenteId}
          votacao={votacao}
          jogo={jogo}
          meuId={meuId}
          agora={agora}
        />
      ))}
    </Dialogo>
  );
}

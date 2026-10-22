import type { EstadoPartidaVisivel, JogadorVisivel } from '@fodinha/shared';
import { Coracoes } from '../../componentes/Coracoes';
import { Dialogo } from '../../componentes/Dialogo';
import { IconeFechar } from '../../componentes/Icones';
import { classes } from '../../lib/classes';
import { NumerosDaRodada } from './NumerosDaRodada';
import { SimbolosMaoEPe } from './SimbolosMaoEPe';
import { idDaVezAtiva, somaDosPalpites } from './visaoDaMesa';

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
  readonly onFechar: () => void;
}

/** Quem tem mais vidas lidera; eliminados vão para o fim. Empate mantém a ordem da mesa. */
function ordenarPorVidas(jogadores: readonly JogadorVisivel[]): JogadorVisivel[] {
  return [...jogadores].sort((a, b) => {
    if (a.eliminado !== b.eliminado) return a.eliminado ? 1 : -1;
    return b.vidas - a.vidas;
  });
}

function situacaoDe(jogador: JogadorVisivel, jogo: EstadoPartidaVisivel): string | null {
  if (jogador.eliminado) return 'Eliminado';
  if (jogador.saiAoFimDaRodada) return 'Saindo';
  if (!jogador.conectado && !jogador.ehBot) return 'Offline';
  if (jogador.id === idDaVezAtiva(jogo)) return jogo.fase === 'palpites' ? 'Palpitando' : 'Jogando';
  return null;
}

/** Placar consultável a qualquer momento: vidas, palpite e vazas feitas de todos na rodada. */
export function DialogoPlacar({ jogo, meuId, onFechar }: Props) {
  const soma = somaDosPalpites(jogo.jogadores);
  const idDaVez = idDaVezAtiva(jogo);
  const cartasTexto = jogo.cartasPorJogador === 1 ? 'carta' : 'cartas';

  return (
    <Dialogo idTitulo="titulo-placar" onFechar={onFechar}>
      <div className="dialogo__cabecalho">
        <h2 id="titulo-placar" className="neon dialogo__titulo">
          Placar
        </h2>
        <button
          type="button"
          className="botao botao--texto botao--icone"
          aria-label="Fechar placar"
          onClick={onFechar}
        >
          <IconeFechar />
        </button>
      </div>

      <p className="placar__rodada">
        Rodada <strong>{jogo.numeroRodada}</strong> · {jogo.cartasPorJogador} {cartasTexto} ·
        manilha <strong>{jogo.manilha ?? '–'}</strong> · palpites somam <strong>{soma}</strong>
      </p>

      <ol className="placar">
        {ordenarPorVidas(jogo.jogadores).map((jogador, posicao) => {
          const situacao = situacaoDe(jogador, jogo);
          const souEu = jogador.id === meuId;
          return (
            <li
              key={jogador.id}
              className={classes(
                'placar__linha',
                souEu && 'placar__linha--eu',
                jogador.id === idDaVez && 'placar__linha--vez',
                jogador.eliminado && 'placar__linha--eliminado',
              )}
            >
              <span className="placar__posicao">{posicao + 1}</span>
              <div className="placar__quem">
                <span className="placar__nome">
                  <span className="placar__apelido">{souEu ? 'Você' : jogador.apelido}</span>
                  {jogador.ehBot && <span className="selo">Bot</span>}
                  <SimbolosMaoEPe
                    ehMao={jogador.id === jogo.idDoPrimeiro}
                    ehPe={jogador.id === jogo.idDoPe}
                    className="simbolos--placar"
                  />
                </span>
                <span className="placar__vidas">
                  <Coracoes vidas={jogador.vidas} vidasIniciais={jogo.configuracao.vidasIniciais} />
                  <span className="placar__vidas-numero">{jogador.vidas}</span>
                  {situacao && <span className="placar__situacao">{situacao}</span>}
                </span>
              </div>
              {!jogador.eliminado && (
                <NumerosDaRodada palpite={jogador.palpite} feitas={jogador.vazasFeitas} />
              )}
            </li>
          );
        })}
      </ol>
    </Dialogo>
  );
}

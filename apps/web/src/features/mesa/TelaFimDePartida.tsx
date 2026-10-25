import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { IconeCoracao } from '../../componentes/Icones';
import { iniciarPartida, sairDaSala, voltarAoLobby } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { useAcao } from '../../lib/useAcao';
import { CabecalhoApp } from '../menu/CabecalhoApp';
import './mesa.css';

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
}

/** Confete só em CSS: cada pedaço recebe coluna, atraso e cor; o resto é a mesma animação. */
const PEDACOS_DE_CONFETE = 28;
const CORES_DO_CONFETE = ['var(--rosa)', 'var(--ciano)', 'var(--dourado)', 'var(--rosa-palido)'];
/** Espalha os pedaços sem aleatoriedade (a tela não muda a cada renderização). */
const PASSO_DA_COLUNA_PCT = 37;
const PASSO_DO_ATRASO_S = 0.23;
const CICLO_DO_ATRASO_S = 2.6;

function Confete() {
  return (
    <div className="confete" aria-hidden="true">
      {Array.from({ length: PEDACOS_DE_CONFETE }, (_, indice) => {
        const estilo: EstiloComVariaveis = {
          '--coluna': `${(indice * PASSO_DA_COLUNA_PCT) % 100}%`,
          '--atraso': `${((indice * PASSO_DO_ATRASO_S) % CICLO_DO_ATRASO_S).toFixed(2)}s`,
          '--cor': CORES_DO_CONFETE[indice % CORES_DO_CONFETE.length] ?? 'var(--rosa)',
          '--giro': `${indice % 2 === 0 ? 1 : -1}`,
        };
        return <span key={indice} className="confete__pedaco" style={estilo} />;
      })}
    </div>
  );
}

/** [x, y, largura, altura] de cada bloco do troféu numa grade 16×16. */
const PIXELS_DO_TROFEU: readonly (readonly [number, number, number, number])[] = [
  [4, 1, 8, 6],
  [5, 7, 6, 1],
  [6, 8, 4, 1],
  [7, 9, 2, 2],
  [5, 11, 6, 1],
  [4, 12, 8, 2],
  [2, 2, 2, 1],
  [2, 3, 1, 2],
  [3, 5, 1, 1],
  [12, 2, 2, 1],
  [13, 3, 1, 2],
  [12, 5, 1, 1],
];

/** Troféu em pixel art, no mesmo traço das cartas. */
function Trofeu() {
  return (
    <svg className="fim__trofeu" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden>
      <g fill="var(--dourado)">
        {PIXELS_DO_TROFEU.map(([x, y, largura, altura]) => (
          <rect key={`${x}-${y}`} x={x} y={y} width={largura} height={altura} />
        ))}
      </g>
      <rect x={5} y={2} width={1} height={4} fill="rgb(255 255 255 / 0.6)" />
    </svg>
  );
}

export function TelaFimDePartida({ jogo, meuId }: Props) {
  const { sala, fonte } = useApp();
  const [ocupado, executar] = useAcao();

  const ehDono = sala?.participantes.find((p) => p.id === meuId)?.ehAnfitriao ?? false;
  const nomes = jogo.vencedores.map(
    (id) => jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador',
  );
  const euVenci = jogo.vencedores.includes(meuId);
  const empate = nomes.length > 1;
  const semVencedor = nomes.length === 0;
  const vidasDoVencedor = jogo.jogadores.find((j) => j.id === jogo.vencedores[0])?.vidas ?? 0;

  const chamada = semVencedor
    ? 'Fim de partida'
    : euVenci
      ? empate
        ? 'Você dividiu a vitória!'
        : 'Você venceu!'
      : empate
        ? 'Empate na liderança!'
        : 'Temos um campeão!';

  return (
    <div className="mesa mesa--fim">
      <CabecalhoApp>Fim de partida</CabecalhoApp>

      <div className="fim painel painel--neon" role="status">
        {!semVencedor && <Confete />}
        <div className="fim__destaque">
          {!semVencedor && <Trofeu />}
          <span className="rotulo-pequeno">{chamada}</span>
          {semVencedor ? (
            <h2 className="neon fim__vencedor">Ninguém sobreviveu</h2>
          ) : (
            <h2 className="neon fim__vencedor">{nomes.join(' e ')}</h2>
          )}
          {!semVencedor && (
            <p className="fim__texto">
              {empate ? 'Terminaram' : 'Terminou'} com {vidasDoVencedor}{' '}
              {vidasDoVencedor === 1 ? 'vida' : 'vidas'}
            </p>
          )}
        </div>

        <ol className="fim__placar" aria-label="Vidas finais">
          {[...jogo.jogadores]
            .sort((a, b) => b.vidas - a.vidas)
            .map((j, posicao) => (
              <li
                key={j.id}
                className={classes(jogo.vencedores.includes(j.id) && 'fim__linha--vencedor')}
              >
                <span className="fim__posicao">{posicao + 1}</span>
                <span className="fim__nome">
                  {j.apelido}
                  {/* O cenário de teste chama o jogador de "Você": evita "Você (você)". */}
                  {j.id === meuId && j.apelido !== 'Você' && ' (você)'}
                </span>
                <span className="fim__vidas">
                  <IconeCoracao className="placa__coracao" />
                  {j.vidas}
                </span>
              </li>
            ))}
        </ol>

        {fonte.origem === 'replay' ? (
          <div className="fim__acoes">
            <p className="fim__texto">
              Fim do replay. Use a barra acima para rever qualquer lance.
            </p>
            <button
              type="button"
              className="botao botao--primario botao--bloco"
              onClick={() => void sairDaSala()}
            >
              Sair do replay
            </button>
          </div>
        ) : (
          <div className="fim__acoes">
            {ehDono ? (
              <button
                type="button"
                className="botao botao--primario botao--bloco"
                disabled={ocupado}
                onClick={() => void executar(iniciarPartida)}
              >
                Jogar novamente
              </button>
            ) : (
              <p className="fim__texto">Aguardando o dono da sala iniciar outra partida…</p>
            )}
            <div className="fim__acoes-secundarias">
              <button type="button" className="botao botao--bloco" onClick={voltarAoLobby}>
                Ver lobby
              </button>
              <button
                type="button"
                className="botao botao--perigo botao--bloco"
                onClick={() => void sairDaSala()}
              >
                Sair da sala
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

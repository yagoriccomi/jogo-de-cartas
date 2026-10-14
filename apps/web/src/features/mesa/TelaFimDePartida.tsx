import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { IconeCoracao } from '../../componentes/Icones';
import { iniciarPartida, sairDaSala, voltarAoLobby } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { useAcao } from '../../lib/useAcao';
import { CabecalhoApp } from '../menu/CabecalhoApp';
import './mesa.css';

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
}

export function TelaFimDePartida({ jogo, meuId }: Props) {
  const { sala } = useApp();
  const [ocupado, executar] = useAcao();

  const ehDono = sala?.participantes.find((p) => p.id === meuId)?.ehAnfitriao ?? false;
  const nomes = jogo.vencedores.map(
    (id) => jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador',
  );
  const euVenci = jogo.vencedores.includes(meuId);
  const empate = nomes.length > 1;

  return (
    <div className="mesa mesa--fim">
      <CabecalhoApp>Fim de partida</CabecalhoApp>

      <div className="fim painel painel--neon" role="status">
        <span className="rotulo-pequeno">Fim de partida</span>
        <h2 className="neon fim__titulo">
          {euVenci
            ? empate
              ? 'Você empatou na liderança!'
              : 'Você venceu!'
            : empate
              ? 'Empate!'
              : 'Temos um vencedor'}
        </h2>
        {nomes.length === 0 ? (
          <p className="fim__texto">A partida terminou sem vencedores.</p>
        ) : (
          <p className="fim__texto">
            {empate ? 'Vencedores: ' : 'Vencedor: '}
            <strong>{nomes.join(', ')}</strong>
          </p>
        )}

        <ol className="fim__placar" aria-label="Vidas finais">
          {[...jogo.jogadores]
            .sort((a, b) => b.vidas - a.vidas)
            .map((j) => (
              <li key={j.id}>
                <span>
                  {j.apelido}
                  {j.id === meuId && ' (você)'}
                </span>
                <span className="fim__vidas">
                  <IconeCoracao className="placa__coracao" />
                  {j.vidas}
                </span>
              </li>
            ))}
        </ol>

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
    </div>
  );
}

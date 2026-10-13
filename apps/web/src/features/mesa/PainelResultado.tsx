import type { EstadoPartidaVisivel } from '@fodinha/shared';

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
}

/** Folha informativa exibida durante `fim_de_rodada`; o servidor avança sozinho, sem botão. */
export function PainelResultado({ jogo, meuId }: Props) {
  const resultados = jogo.resultadoRodada;
  if (!resultados) return null;

  const nomeDe = (id: string) => jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador';

  return (
    <div
      className="sobreposicao"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-resultado"
    >
      <div className="folha">
        <h2 id="titulo-resultado" className="folha__titulo">
          Resultado da rodada {jogo.numeroRodada}
        </h2>
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
            {resultados.map((r) => (
              <tr key={r.jogadorId} className={r.jogadorId === meuId ? 'resultado__eu' : undefined}>
                <th scope="row">{nomeDe(r.jogadorId)}</th>
                <td>{r.palpite}</td>
                <td>{r.vazasFeitas}</td>
                <td className={r.vidasPerdidas > 0 ? 'resultado__perdeu' : 'resultado__ok'}>
                  {r.vidasPerdidas > 0 ? `−${r.vidasPerdidas}` : 'ok'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="folha__rodape">A próxima rodada começa em instantes…</p>
      </div>
    </div>
  );
}

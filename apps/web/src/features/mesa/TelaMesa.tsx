import { jogarCarta, palpitar, sairDaSala } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { useAcao } from '../../lib/useAcao';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';
import { JogadorChip } from './JogadorChip';
import { Mao } from './Mao';
import { PainelResultado } from './PainelResultado';
import { SeletorDePalpite } from './SeletorDePalpite';
import { TelaFimDePartida } from './TelaFimDePartida';
import './mesa.css';

export function TelaMesa() {
  const { jogo, sala, sessao } = useApp();
  const [ocupado, executar] = useAcao();

  // O roteador garante jogo e sessão; o guard evita `!` e protege contra corrida de estado.
  if (!jogo || !sessao) return null;

  const meuId = sessao.jogadorId;
  if (jogo.fase === 'encerrada') {
    return <TelaFimDePartida jogo={jogo} meuId={meuId} />;
  }

  const eu = jogo.jogadores.find((j) => j.id === meuId);
  const nomeDe = (id: string | null) =>
    id === null ? null : (jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador');

  const souDaVez = jogo.idDaVez === meuId;
  const estouEliminado = eu?.eliminado ?? false;
  const palpitando = jogo.fase === 'palpites' && souDaVez && !estouEliminado;
  const podeJogar = jogo.fase === 'jogando' && souDaVez && !estouEliminado;

  let situacao: string;
  if (jogo.fase === 'fim_de_rodada') situacao = 'Fim da rodada';
  else if (souDaVez)
    situacao = jogo.fase === 'palpites' ? 'Sua vez de palpitar' : 'Sua vez de jogar';
  else if (jogo.idDaVez !== null)
    situacao = `Vez de ${nomeDe(jogo.idDaVez)} ${jogo.fase === 'palpites' ? 'palpitar' : 'jogar'}`;
  else situacao = 'Aguardando…';

  const ultimaVaza = jogo.ultimaVaza;
  const vencedorUltimaVaza = ultimaVaza ? nomeDe(ultimaVaza.vencedorId) : null;

  return (
    <div className="mesa">
      <div className="mesa__topo">
        <span>
          <strong>Rodada {jogo.numeroRodada}</strong> · {jogo.cartasPorJogador}{' '}
          {jogo.cartasPorJogador === 1 ? 'carta' : 'cartas'}
          {jogo.rodadaCega && <span className="selo selo--alerta mesa__cega">Cega</span>}
        </span>
        <span className="mesa__sala">
          Sala {sala?.codigo}
          <button
            type="button"
            className="botao botao--discreto botao--perigo"
            onClick={() => void sairDaSala()}
          >
            Sair
          </button>
        </span>
      </div>

      <ul className="mesa__jogadores" aria-label="Jogadores">
        {jogo.jogadores.map((jogador) => (
          <JogadorChip
            key={jogador.id}
            jogador={jogador}
            ehEu={jogador.id === meuId}
            ehPe={jogador.id === jogo.idDoPe}
            ehDaVez={jogador.id === jogo.idDaVez && jogo.fase !== 'fim_de_rodada'}
            prazoDaVezEm={jogo.prazoDaVezEm}
            manilha={jogo.manilha}
          />
        ))}
      </ul>

      <section className="feltro" aria-label="Mesa">
        <div className="feltro__cabecalho">
          <div className="feltro__vira">
            <span className="feltro__rotulo">Vira</span>
            <Carta carta={jogo.vira} tamanho="m" manilha={jogo.manilha} rotulo="Vira" />
          </div>
          <div className="feltro__manilha">
            <span className="feltro__rotulo">Manilha</span>
            <strong className="feltro__manilha-valor">{jogo.manilha ?? '–'}</strong>
          </div>
          <div className="feltro__situacao" aria-live="polite">
            <span className={souDaVez ? 'feltro__vez feltro__vez--eu' : 'feltro__vez'}>
              {situacao}
            </span>
            {jogo.prazoDaVezEm !== null &&
              jogo.idDaVez !== null &&
              jogo.fase !== 'fim_de_rodada' && <ContagemRegressiva prazoEm={jogo.prazoDaVezEm} />}
          </div>
        </div>

        <div className="feltro__jogadas">
          {jogo.mesa.length === 0 ? (
            <p className="feltro__vazio">Nenhuma carta na mesa ainda.</p>
          ) : (
            <ul className="jogadas">
              {jogo.mesa.map((jogada) => (
                <li key={jogada.jogadorId} className="jogadas__item">
                  <Carta carta={jogada.carta} tamanho="m" manilha={jogo.manilha} />
                  <span className="jogadas__nome">{nomeDe(jogada.jogadorId)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {ultimaVaza && (
          <div className="ultima">
            <span className="feltro__rotulo">
              Última vaza ·{' '}
              {vencedorUltimaVaza !== null
                ? `venceu ${vencedorUltimaVaza}`
                : 'anulada (cartas iguais)'}
            </span>
            <ul className="ultima__cartas">
              {ultimaVaza.jogadas.map((jogada) => (
                <li key={jogada.jogadorId} title={nomeDe(jogada.jogadorId) ?? undefined}>
                  <Carta carta={jogada.carta} tamanho="p" manilha={jogo.manilha} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="mesa__minha" aria-label="Minha área">
        {estouEliminado ? (
          <p className="mesa__eliminado" role="status">
            Você foi eliminado. Acompanhe a partida até o fim.
          </p>
        ) : (
          <>
            {palpitando && (
              <SeletorDePalpite
                cartasNaRodada={jogo.cartasPorJogador}
                palpiteProibido={jogo.palpiteProibido}
                ocupado={ocupado}
                onConfirmar={(quantidade) => void executar(() => palpitar(quantidade))}
              />
            )}
            {jogo.rodadaCega && (
              <p className="mesa__dica">Rodada cega: você não vê sua carta, mas vê a dos outros.</p>
            )}
            <Mao
              cartas={jogo.minhaMao}
              manilha={jogo.manilha}
              podeJogar={podeJogar && !ocupado}
              onJogar={(cartaId) => void executar(() => jogarCarta(cartaId))}
            />
          </>
        )}
      </section>

      {jogo.fase === 'fim_de_rodada' && <PainelResultado jogo={jogo} meuId={meuId} />}
    </div>
  );
}

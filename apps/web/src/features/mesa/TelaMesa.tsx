import { useRef } from 'react';
import type { JogadaNaMesa } from '@fodinha/shared';
import { Coracoes } from '../../componentes/Coracoes';
import { jogarCarta, palpitar } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { classes } from '../../lib/classes';
import { useAcao } from '../../lib/useAcao';
import { CabecalhoApp } from '../menu/CabecalhoApp';
import { Baralho } from './Baralho';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';
import { Mao } from './Mao';
import { MesaLinhas } from './MesaLinhas';
import { Montinhos } from './Montinhos';
import { PainelPalpite, type PalpiteDado } from './PainelPalpite';
import { PainelPausa } from './PainelPausa';
import { PainelResultado } from './PainelResultado';
import { PlacaJogador } from './PlacaJogador';
import { TelaFimDePartida } from './TelaFimDePartida';
import { useAnimacaoDeVaza } from './useAnimacaoDeVaza';
import { aberturaDaPartida, useBaralho } from './useBaralho';
import { useMesaJogadas } from './useMesaJogadas';
import './mesa.css';

const SEM_CARTAS: readonly JogadaNaMesa[] = [];
/** Acima de quantos adversários vale a dica "arraste para ver mais". */
const ADVERSARIOS_VISIVEIS_NO_CELULAR = 2;

export function TelaMesa() {
  const { jogo, sala, sessao, jogoRecebidoEm } = useApp();
  const [ocupado, executar] = useAcao();
  // Hook antes dos retornos antecipados: a ordem dos hooks não pode depender do estado do jogo.
  const animacao = useAnimacaoDeVaza(
    jogo?.ultimaVaza ?? null,
    (jogo?.mesa.length ?? 0) === 0,
    jogo?.rodadaCega ?? false,
  );
  const viraRef = useRef<HTMLDivElement>(null);
  // Enquanto a vaza fechada está em cena, é ela que as linhas exibem (a mesa já foi limpa).
  const cartasNaMesa = animacao.vaza?.jogadas ?? jogo?.mesa ?? SEM_CARTAS;
  useBaralho({
    jogo,
    meuId: sessao?.jogadorId ?? null,
    recebidoEm: jogoRecebidoEm,
    vira: viraRef,
  });
  useMesaJogadas({
    cartas: cartasNaMesa,
    meuId: sessao?.jogadorId ?? null,
    rodadaCega: jogo?.rodadaCega ?? false,
    raiz: animacao.raiz,
  });

  // O roteador garante jogo e sessão; o guard evita `!` e protege contra corrida de estado.
  if (!jogo || !sessao) return null;

  const meuId = sessao.jogadorId;
  if (jogo.fase === 'encerrada') {
    return <TelaFimDePartida jogo={jogo} meuId={meuId} />;
  }

  const eu = jogo.jogadores.find((j) => j.id === meuId);
  const participante = sala?.participantes.find((p) => p.id === meuId);
  const aguardandoProximaRodada = participante?.aguardandoProximaRodada ?? eu === undefined;
  const adversarios = jogo.jogadores.filter((j) => j.id !== meuId);
  const nomeDe = (id: string | null) => {
    if (id === null) return null;
    if (id === meuId) return 'Você';
    return jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador';
  };

  const pausado = (jogo.pausa?.votacoes.length ?? 0) > 0;
  const emRodada = jogo.fase === 'palpites' || jogo.fase === 'jogando';
  const souDaVez = emRodada && jogo.idDaVez === meuId && !pausado;
  const estouEliminado = eu?.eliminado ?? false;
  const palpitando = jogo.fase === 'palpites' && souDaVez && !estouEliminado;
  const podeJogar = jogo.fase === 'jogando' && souDaVez && !estouEliminado;

  // Contagem a partir do "tempo restante" que o servidor mandou, não do relógio dele.
  const prazoFinal =
    emRodada && !pausado && jogo.prazoDaVezRestanteMs !== null
      ? jogoRecebidoEm + jogo.prazoDaVezRestanteMs
      : null;

  const palpitesDados: PalpiteDado[] = adversarios.flatMap((j) =>
    j.palpite === null || j.eliminado ? [] : [{ apelido: j.apelido, palpite: j.palpite }],
  );

  let situacao: string;
  if (aguardandoProximaRodada) situacao = 'Você entra na próxima rodada';
  else if (pausado) situacao = 'Partida pausada';
  else if (jogo.fase === 'fim_de_rodada') situacao = 'Fim da rodada';
  else if (souDaVez)
    situacao = jogo.fase === 'palpites' ? 'Sua vez de palpitar' : 'Sua vez de jogar';
  else if (jogo.idDaVez !== null)
    situacao = `Vez de ${nomeDe(jogo.idDaVez)} ${jogo.fase === 'palpites' ? 'palpitar' : 'jogar'}`;
  else situacao = 'Aguardando…';

  const vazaEmCena = animacao.vaza;
  // O montinho novo só aparece quando a animação chega; até lá fica reservado (invisível).
  const donoDoMonteOculto = vazaEmCena?.vencedorId ?? null;
  const cartasTexto = jogo.cartasPorJogador === 1 ? 'carta' : 'cartas';

  return (
    <div className="mesa">
      <CabecalhoApp>
        Rodada {jogo.numeroRodada} · {jogo.cartasPorJogador} {cartasTexto}
        {jogo.rodadaCega && <span className="selo selo--alerta mesa__cega">Cega</span>}
      </CabecalhoApp>

      <div className="adversarios-area">
        <ul className="adversarios" aria-label="Adversários">
          {adversarios.map((jogador) => {
            const ehDaVez = jogador.id === jogo.idDaVez && emRodada;
            return (
              <PlacaJogador
                key={jogador.id}
                jogador={jogador}
                ehPe={jogador.id === jogo.idDoPe}
                ehPrimeiro={jogador.id === jogo.idDoPrimeiro}
                ehDaVez={ehDaVez}
                prazoFinal={ehDaVez ? prazoFinal : null}
                manilha={jogo.manilha}
                vidasIniciais={jogo.configuracao.vidasIniciais}
                ocultarUltimoMonte={jogador.id === donoDoMonteOculto}
              />
            );
          })}
        </ul>
        {adversarios.length > ADVERSARIOS_VISIVEIS_NO_CELULAR && (
          <p className="adversarios__dica so-celular">
            Fez / palpite · arraste para ver mais jogadores
          </p>
        )}
      </div>

      <div className="palco">
        <section
          className={classes('feltro', palpitando && 'feltro--palpitando')}
          aria-label="Mesa"
        >
          <div className="feltro__esquerda">
            <div className="feltro__monte">
              <div className="feltro__vira-bloco">
                <span className="rotulo-pequeno feltro__rotulo">Vira</span>
                <div ref={viraRef} className="feltro__vira">
                  <Carta carta={jogo.vira} manilha={jogo.manilha} rotulo="Vira" />
                </div>
              </div>
              <Baralho />
            </div>
            <div className="feltro__manilha">
              <span className="rotulo-pequeno feltro__rotulo">Manilha</span>
              <strong className="feltro__manilha-valor">{jogo.manilha ?? '–'}</strong>
            </div>
          </div>

          <div className="feltro__jogadas">
            {cartasNaMesa.length === 0 && (
              <p className="feltro__vazio">
                {jogo.fase === 'palpites'
                  ? 'Palpites em andamento…'
                  : podeJogar
                    ? 'Sua vez: jogue uma carta'
                    : 'Nenhuma carta na mesa ainda.'}
              </p>
            )}
            {/* Sempre montadas: manter o mesmo DOM entre a mesa e a vaza fechada preserva os voos. */}
            <MesaLinhas
              cartas={cartasNaMesa}
              manilha={jogo.manilha}
              nomeDe={(id) => nomeDe(id) ?? 'Jogador'}
              voando={animacao.voando}
              raiz={animacao.raiz}
            />
          </div>
        </section>

        {palpitando && (
          <PainelPalpite
            key={jogo.numeroRodada}
            cartasNaRodada={jogo.cartasPorJogador}
            palpiteProibido={jogo.palpiteProibido}
            souOPe={jogo.idDoPe === meuId}
            palpitesDados={palpitesDados}
            prazoFinal={prazoFinal}
            ocupado={ocupado}
            onConfirmar={(quantidade) => void executar(() => palpitar(quantidade))}
          />
        )}
      </div>

      <section
        className={classes('minha', palpitando && 'minha--palpitando')}
        aria-label="Minha área"
      >
        <div className="minha__barra">
          <div className="minha__dados">
            <span className="neon neon--ciano minha__nome">
              {eu?.apelido ?? sala?.participantes.find((p) => p.id === meuId)?.apelido ?? 'Você'}
            </span>
            {eu && !eu.eliminado && (
              <span className="minha__info">
                {jogo.idDoPe === meuId && <span className="selo selo--pe">Pé</span>}
                {jogo.idDoPrimeiro === meuId && <span className="selo selo--dono">Abre</span>}
                Palpite {eu.palpite ?? '–'} · Fez {eu.vazasFeitas}
              </span>
            )}
            {eu && (
              <Coracoes
                vidas={eu.vidas}
                vidasIniciais={jogo.configuracao.vidasIniciais}
                className="minha__vidas"
              />
            )}
          </div>
          <span
            className={classes('vez', souDaVez && 'vez--minha')}
            role="status"
            aria-live="polite"
          >
            {souDaVez ? 'Sua vez' : situacao}
            {souDaVez && prazoFinal !== null && (
              <ContagemRegressiva prazoFinal={prazoFinal} className="pilula pilula--escura" />
            )}
          </span>
        </div>

        {eu && (
          <Montinhos
            jogadorId={eu.id}
            vazas={eu.vazasGanhas}
            manilha={jogo.manilha}
            ocultarUltimo={eu.id === donoDoMonteOculto}
            className="montes--minha"
          />
        )}

        {aguardandoProximaRodada && (
          <p className="minha__aviso" role="status">
            Você entra na próxima rodada. Enquanto isso, acompanhe a mesa.
          </p>
        )}
        {estouEliminado && (
          <p className="minha__aviso" role="status">
            Você foi eliminado. Acompanhe a partida até o fim.
          </p>
        )}
        {jogo.rodadaCega && !aguardandoProximaRodada && !estouEliminado && (
          <p className="minha__dica-cega">
            Rodada cega: você não vê a sua carta, mas vê a dos outros.
          </p>
        )}

        {!estouEliminado && (
          <Mao
            cartas={jogo.minhaMao}
            manilha={jogo.manilha}
            numeroRodada={jogo.numeroRodada}
            jogadoresNaMesa={jogo.jogadores.filter((j) => !j.eliminado).length}
            animarAoMontar={aberturaDaPartida(jogo, jogoRecebidoEm)}
            podeJogar={podeJogar && !ocupado}
            apagar={jogo.fase === 'jogando' && !souDaVez}
            onJogar={(cartaId) => void executar(() => jogarCarta(cartaId))}
          />
        )}
      </section>

      {/* O resultado espera a última vaza chegar ao montinho; senão cobre a animação. */}
      {jogo.fase === 'fim_de_rodada' && !pausado && vazaEmCena === null && (
        <PainelResultado jogo={jogo} meuId={meuId} recebidoEm={jogoRecebidoEm} />
      )}
      {pausado && <PainelPausa jogo={jogo} meuId={meuId} />}
    </div>
  );
}

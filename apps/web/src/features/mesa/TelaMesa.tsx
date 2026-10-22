import { useRef, useState } from 'react';
import type { JogadaNaMesa } from '@fodinha/shared';
import { Coracoes } from '../../componentes/Coracoes';
import { IconeLivro, IconePlacar } from '../../componentes/Icones';
import { jogarCarta, palpitar } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { classes } from '../../lib/classes';
import { useAcao } from '../../lib/useAcao';
import { CONSULTA_COMPUTADOR, useMediaQuery } from '../../lib/useMediaQuery';
import { useSonsDaMesa } from '../som/useSonsDaMesa';
import { CabecalhoApp } from '../menu/CabecalhoApp';
import { DialogoRegras } from '../menu/DialogoRegras';
import { ResumoDasRegras } from '../regras/ResumoDasRegras';
import { ALVOS, marcarAlvo } from './alvos';
import { DESTINO_DOS_EMPATES } from './animacao-compartilhada';
import { Baralho } from './Baralho';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';
import { DialogoMaoRevelada } from './DialogoMaoRevelada';
import { DialogoPlacar } from './DialogoPlacar';
import { Mao } from './Mao';
import { MesaLinhas } from './MesaLinhas';
import { Montinhos } from './Montinhos';
import { NumerosDaRodada } from './NumerosDaRodada';
import { PainelPalpite } from './PainelPalpite';
import { PainelPausa } from './PainelPausa';
import { PainelResultado } from './PainelResultado';
import { SimbolosMaoEPe } from './SimbolosMaoEPe';
import { PlacaJogador } from './PlacaJogador';
import { ReacoesDaMesa } from './ReacoesDaMesa';
import { AndamentoDosPalpites } from './AndamentoDosPalpites';
import { TelaFimDePartida } from './TelaFimDePartida';
import { MonteDeEmpates } from './MonteDeEmpates';
import { contagemVisivel } from './cenaDaVaza';
import { useAnimacaoDeVaza } from './useAnimacaoDeVaza';
import { useRolarAtePlacaDaVez, useTituloDaVez } from './useSinaisDaVez';
import { aberturaDaPartida, useBaralho } from './useBaralho';
import { useMesaJogadas } from './useMesaJogadas';
import { idDaVezAtiva, visaoDaMesa } from './visaoDaMesa';
import './mesa.css';

const SEM_CARTAS: readonly JogadaNaMesa[] = [];

type Consulta = 'placar' | 'regras' | null;

export function TelaMesa() {
  const { jogo, sala, sessao, jogoRecebidoEm, fonte } = useApp();
  const comServidor = fonte.origem === 'servidor';
  const [ocupado, executar] = useAcao();
  const [consulta, definirConsulta] = useState<Consulta>(null);
  const [maoAbertaDe, definirMaoAbertaDe] = useState<string | null>(null);
  const computador = useMediaQuery(CONSULTA_COMPUTADOR);
  // Hook antes dos retornos antecipados: a ordem dos hooks não pode depender do estado do jogo.
  const animacao = useAnimacaoDeVaza({
    ultimaVaza: jogo?.ultimaVaza ?? null,
    mesaVazia: (jogo?.mesa.length ?? 0) === 0,
    rodadaCega: jogo?.rodadaCega ?? false,
    fase: jogo?.fase ?? null,
  });
  useSonsDaMesa(jogo, sessao?.jogadorId ?? null);
  const viraRef = useRef<HTMLDivElement>(null);
  const adversariosRef = useRef<HTMLUListElement>(null);
  // Hooks antes dos retornos antecipados; o resto da visão da mesa é calculado mais abaixo.
  const idDaVezAtivo = jogo === null ? null : idDaVezAtiva(jogo);
  useTituloDaVez(idDaVezAtivo !== null && idDaVezAtivo === sessao?.jogadorId);
  useRolarAtePlacaDaVez(adversariosRef, idDaVezAtivo);
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
  if (animacao.fimDePartidaPodeAparecer) {
    return <TelaFimDePartida jogo={jogo} meuId={meuId} />;
  }

  // O montinho novo só aparece quando a animação chega; até lá fica reservado (invisível).
  const { monteEmVoo } = animacao;
  const visao = visaoDaMesa({ jogo, sala, meuId, recebidoEm: jogoRecebidoEm, monteEmVoo });
  const {
    eu,
    pausado,
    souDaVez,
    estouEliminado,
    aguardandoProximaRodada,
    palpitando,
    podeJogar,
    prazoFinal,
    vazaAtual,
    nomeDe,
  } = visao;
  const jogadorDaMaoAberta = jogo.jogadores.find((j) => j.id === maoAbertaDe);

  const cartasTexto = jogo.cartasPorJogador === 1 ? 'carta' : 'cartas';

  return (
    <div className="mesa">
      <CabecalhoApp
        recolhivel
        acoes={
          <>
            <button
              type="button"
              className="botao botao--icone botao--consulta"
              aria-label="Placar"
              title="Placar"
              onClick={() => definirConsulta('placar')}
            >
              <IconePlacar />
            </button>
            <button
              type="button"
              className="botao botao--icone botao--consulta"
              aria-label="Regras"
              title="Regras"
              onClick={() => definirConsulta('regras')}
            >
              <IconeLivro />
            </button>
          </>
        }
      >
        Rodada {jogo.numeroRodada} · {jogo.cartasPorJogador} {cartasTexto}
        {jogo.rodadaCega && <span className="selo selo--alerta mesa__cega">Cega</span>}
      </CabecalhoApp>

      <div className="adversarios-area">
        <ul
          ref={adversariosRef}
          className="adversarios"
          aria-label="Adversários"
          {...marcarAlvo(ALVOS.adversarios)}
        >
          {visao.adversarios.map((jogador) => {
            const ehDaVez = jogador.id === visao.idDaVez;
            return (
              <PlacaJogador
                key={jogador.id}
                jogador={jogador}
                ehPe={jogador.id === jogo.idDoPe}
                ehPrimeiro={jogador.id === jogo.idDoPrimeiro}
                rotularMaoEPe={visao.rotularMaoEPe}
                ehDaVez={ehDaVez}
                prazoFinal={ehDaVez ? prazoFinal : null}
                manilha={jogo.manilha}
                vidasIniciais={jogo.configuracao.vidasIniciais}
                feitasVisiveis={contagemVisivel(monteEmVoo, jogador.id, jogador.vazasFeitas)}
                montesVisiveis={contagemVisivel(monteEmVoo, jogador.id, jogador.vazasGanhas.length)}
                onVerMao={jogador.maoRevelada ? () => definirMaoAbertaDe(jogador.id) : undefined}
              />
            );
          })}
        </ul>
      </div>

      <div className="palco">
        <section className="feltro" aria-label="Mesa">
          <div className="feltro__esquerda" {...marcarAlvo(ALVOS.viraEManilha)}>
            <div className="feltro__monte">
              <div className="feltro__vira-bloco">
                <span
                  className="neon neon--ciano feltro__vaza"
                  aria-label={`Vaza ${vazaAtual} de ${jogo.cartasPorJogador}`}
                  title="Vaza da rodada"
                >
                  {vazaAtual}/{jogo.cartasPorJogador}
                </span>
                <span className="rotulo-pequeno feltro__rotulo">Vira</span>
                <div ref={viraRef} className="feltro__vira">
                  <Carta carta={jogo.vira} manilha={jogo.manilha} rotulo="Vira" />
                </div>
              </div>
              <Baralho />
            </div>
            {/* Rótulo dentro do selo: nada da coluna da vira o cobre, em nenhum tamanho de mesa. */}
            <div className="feltro__manilha">
              <span className="feltro__manilha-holo" aria-hidden="true" />
              <span className="feltro__manilha-rotulo">Manilha</span>
              <strong className="feltro__manilha-valor">{jogo.manilha ?? '–'}</strong>
            </div>
            <MonteDeEmpates
              vazas={jogo.vazasEmpatadas}
              manilha={jogo.manilha}
              visiveis={contagemVisivel(
                monteEmVoo,
                DESTINO_DOS_EMPATES,
                jogo.vazasEmpatadas.length,
              )}
            />
          </div>

          <div className="feltro__jogadas">
            {jogo.fase === 'palpites' && !palpitando && (
              <AndamentoDosPalpites
                nomeDaVez={nomeDe(visao.idDaVez)}
                soma={visao.palpite.soma}
                cartasNaRodada={jogo.cartasPorJogador}
                palpitaram={visao.palpite.palpitaram}
                vivos={visao.palpite.vivos}
              />
            )}
            {cartasNaMesa.length === 0 && jogo.fase !== 'palpites' && (
              <p className="feltro__vazio">
                {podeJogar ? 'Sua vez: jogue uma carta' : 'Nenhuma carta na mesa ainda.'}
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

          {/* Chamada de atenção a cada vez nova; a chave remonta o elemento e reinicia a animação. */}
          {visao.devoAgir && (
            <p
              key={`${jogo.numeroRodada}-${jogo.fase}-${jogo.mesa.length}`}
              className="faixa-da-vez"
              aria-hidden="true"
            >
              Sua vez!
            </p>
          )}

          {/* Filho do feltro (não das jogadas): no celular cobre a mesa toda, vira inclusa. */}
          {palpitando && (
            <PainelPalpite
              key={jogo.numeroRodada}
              cartasNaRodada={jogo.cartasPorJogador}
              palpite={visao.palpite}
              vira={jogo.vira}
              manilha={jogo.manilha}
              ocupado={ocupado}
              onConfirmar={(quantidade) => void executar(() => palpitar(quantidade))}
            />
          )}
        </section>
      </div>

      <section
        className={classes('minha', podeJogar && !ocupado && 'minha--jogar')}
        aria-label="Minha área"
        {...marcarAlvo(ALVOS.minhaArea)}
      >
        {/* O tutorial roda sem sala no servidor: não há para quem reagir. */}
        {comServidor && <ReacoesDaMesa meuId={meuId} jogadores={jogo.jogadores} />}
        <div className="minha__barra">
          <div className="minha__dados">
            <SimbolosMaoEPe
              ehMao={jogo.idDoPrimeiro === meuId}
              ehPe={jogo.idDoPe === meuId}
              className="simbolos--minha"
            />
            {/* Neon só em quem está com a vez; fora dela o status fica apagado. */}
            <span
              className={classes(
                'minha__nome',
                souDaVez ? 'neon neon--ciano' : 'minha__nome--apagado',
              )}
            >
              {eu?.apelido ?? sala?.participantes.find((p) => p.id === meuId)?.apelido ?? 'Você'}
            </span>
            {eu && (
              <Coracoes
                vidas={eu.vidas}
                vidasIniciais={jogo.configuracao.vidasIniciais}
                className="minha__vidas"
              />
            )}
          </div>
          {eu && !eu.eliminado && (
            <NumerosDaRodada
              palpite={eu.palpite}
              feitas={visao.minhasFeitas}
              destinoDoMonte={computador ? undefined : eu.id}
              className="numeros--minha"
            />
          )}
          {/* Computador: meus montinhos na própria barra; no celular o "Fez" é o destino. */}
          {eu && computador && (
            <Montinhos
              jogadorId={eu.id}
              vazas={eu.vazasGanhas}
              manilha={jogo.manilha}
              visiveis={contagemVisivel(monteEmVoo, eu.id, eu.vazasGanhas.length)}
              className="montes--minha"
            />
          )}
          <span
            className={classes('vez', souDaVez && 'vez--minha')}
            role="status"
            aria-live="polite"
          >
            {souDaVez ? 'Sua vez' : visao.situacao.texto}
            {souDaVez && prazoFinal !== null && (
              <ContagemRegressiva
                prazoFinal={prazoFinal}
                className="pilula pilula--escura"
                alertar
              />
            )}
          </span>
        </div>

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

        {!estouEliminado && (
          <Mao
            cartas={jogo.minhaMao}
            manilha={jogo.manilha}
            numeroRodada={jogo.numeroRodada}
            jogadoresNaMesa={visao.vivosNaMesa}
            animarAoMontar={aberturaDaPartida(jogo, jogoRecebidoEm)}
            podeJogar={podeJogar && !ocupado}
            apagar={visao.apagarMao}
            onJogar={(cartaId) => void executar(() => jogarCarta(cartaId))}
          />
        )}
      </section>

      {animacao.resultadoPodeAparecer && !pausado && (
        <PainelResultado jogo={jogo} meuId={meuId} recebidoEm={jogoRecebidoEm} />
      )}
      {pausado && <PainelPausa jogo={jogo} meuId={meuId} />}
      <ResumoDasRegras
        jogo={jogo}
        meuId={meuId}
        recebidoEm={jogoRecebidoEm}
        ativo={comServidor && eu !== undefined && !estouEliminado}
      />
      {consulta === 'placar' && (
        <DialogoPlacar jogo={jogo} meuId={meuId} onFechar={() => definirConsulta(null)} />
      )}
      {consulta === 'regras' && <DialogoRegras onFechar={() => definirConsulta(null)} />}
      {jogadorDaMaoAberta && (
        <DialogoMaoRevelada
          jogador={jogadorDaMaoAberta}
          manilha={jogo.manilha}
          onFechar={() => definirMaoAbertaDe(null)}
        />
      )}
    </div>
  );
}

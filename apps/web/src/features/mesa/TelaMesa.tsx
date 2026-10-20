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
import { emOrdemDeJogo } from './ordemDeJogo';
import { PainelPalpite, type PalpiteAnterior } from './PainelPalpite';
import { PainelPausa } from './PainelPausa';
import { PainelResultado } from './PainelResultado';
import { SimbolosMaoEPe } from './SimbolosMaoEPe';
import { PlacaJogador } from './PlacaJogador';
import { ReacoesDaMesa } from './ReacoesDaMesa';
import { TelaFimDePartida } from './TelaFimDePartida';
import { MonteDeEmpates } from './MonteDeEmpates';
import { useAnimacaoDeVaza } from './useAnimacaoDeVaza';
import { useRolarAtePlacaDaVez, useTituloDaVez } from './useSinaisDaVez';
import { aberturaDaPartida, useBaralho } from './useBaralho';
import { useMesaJogadas } from './useMesaJogadas';
import './mesa.css';

const SEM_CARTAS: readonly JogadaNaMesa[] = [];

type Consulta = 'placar' | 'regras' | null;

export function TelaMesa() {
  const { jogo, sala, sessao, jogoRecebidoEm, tutorial } = useApp();
  const [ocupado, executar] = useAcao();
  const [consulta, definirConsulta] = useState<Consulta>(null);
  const [maoAbertaDe, definirMaoAbertaDe] = useState<string | null>(null);
  const computador = useMediaQuery(CONSULTA_COMPUTADOR);
  // Hook antes dos retornos antecipados: a ordem dos hooks não pode depender do estado do jogo.
  const animacao = useAnimacaoDeVaza(
    jogo?.ultimaVaza ?? null,
    (jogo?.mesa.length ?? 0) === 0,
    jogo?.rodadaCega ?? false,
    jogo?.fase === 'fim_de_rodada' || jogo?.fase === 'encerrada',
  );
  useSonsDaMesa(jogo, sessao?.jogadorId ?? null);
  const viraRef = useRef<HTMLDivElement>(null);
  const adversariosRef = useRef<HTMLUListElement>(null);
  // Hooks antes dos retornos antecipados; o cálculo completo de "minha vez" fica mais abaixo.
  const vezEmRodada =
    jogo !== null && (jogo.fase === 'palpites' || jogo.fase === 'jogando') && jogo.pausa === null;
  const idDaVezAtivo = vezEmRodada ? jogo.idDaVez : null;
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
  // A última vaza da partida ainda voa para o montinho antes de o vencedor ser celebrado.
  if (jogo.fase === 'encerrada' && animacao.vaza === null) {
    return <TelaFimDePartida jogo={jogo} meuId={meuId} />;
  }

  const eu = jogo.jogadores.find((j) => j.id === meuId);
  const participante = sala?.participantes.find((p) => p.id === meuId);
  const aguardandoProximaRodada = participante?.aguardandoProximaRodada ?? eu === undefined;
  // Placas na ordem de jogo: a mão fica à esquerda e o pé à direita.
  const ordemDeJogo = emOrdemDeJogo(jogo.jogadores, jogo.idDoPrimeiro, jogo.idDoPe);
  const adversarios = ordemDeJogo.filter((j) => j.id !== meuId);
  const nomeDe = (id: string | null) => {
    if (id === null) return null;
    if (id === meuId) return 'Você';
    return jogo.jogadores.find((j) => j.id === id)?.apelido ?? 'Jogador';
  };

  // Pausa por votação de ausente ou pelo dono: em ambos a mesa fica congelada.
  const pausado = jogo.pausa !== null;
  const emRodada = jogo.fase === 'palpites' || jogo.fase === 'jogando';
  const souDaVez = emRodada && jogo.idDaVez === meuId && !pausado;
  const estouEliminado = eu?.eliminado ?? false;
  const jogadorDaMaoAberta = jogo.jogadores.find((j) => j.id === maoAbertaDe);
  const palpitando = jogo.fase === 'palpites' && souDaVez && !estouEliminado;
  const podeJogar = jogo.fase === 'jogando' && souDaVez && !estouEliminado;

  // Contagem a partir do "tempo restante" que o servidor mandou, não do relógio dele.
  const prazoFinal =
    emRodada && !pausado && jogo.prazoDaVezRestanteMs !== null
      ? jogoRecebidoEm + jogo.prazoDaVezRestanteMs
      : null;

  const vivosEmOrdem = ordemDeJogo.filter((j) => !j.eliminado);
  const minhaPosicao = vivosEmOrdem.findIndex((j) => j.id === meuId);
  const palpitesAnteriores: PalpiteAnterior[] = vivosEmOrdem
    .slice(0, Math.max(minhaPosicao, 0))
    .flatMap((j) =>
      j.palpite === null
        ? []
        : [{ id: j.id, nome: j.apelido, palpite: j.palpite, ehMao: j.id === jogo.idDoPrimeiro }],
    );
  const depoisDeVoce = minhaPosicao === -1 ? 0 : vivosEmOrdem.length - minhaPosicao - 1;

  let situacao: string;
  if (aguardandoProximaRodada) situacao = 'Você entra na próxima rodada';
  else if (pausado) situacao = 'Partida pausada';
  else if (jogo.fase === 'fim_de_rodada') situacao = 'Fim da rodada';
  else if (souDaVez)
    situacao = jogo.fase === 'palpites' ? 'Sua vez de palpitar' : 'Sua vez de jogar';
  else if (jogo.idDaVez !== null)
    // Só o primeiro nome: "Paula Tejano" inteiro espremeria o meu status na barra.
    situacao = `Vez de ${nomeDe(jogo.idDaVez)?.split(' ')[0]} ${jogo.fase === 'palpites' ? 'palpitar' : 'jogar'}`;
  else situacao = 'Aguardando…';

  const vazaEmCena = animacao.vaza;
  // O montinho novo só aparece quando a animação chega; até lá fica reservado (invisível).
  const donoDoMonteOculto = vazaEmCena ? (vazaEmCena.vencedorId ?? DESTINO_DOS_EMPATES) : null;
  const cartasTexto = jogo.cartasPorJogador === 1 ? 'carta' : 'cartas';
  // Vazas já decididas na rodada (ganhas por alguém ou todas anuladas); a da vez é a seguinte.
  const vazasDecididas =
    jogo.jogadores.reduce((soma, j) => soma + j.vazasFeitas, 0) + jogo.vazasEmpatadas.length;
  const vazaAtual = Math.min(vazasDecididas + 1, jogo.cartasPorJogador);
  const minhasFeitas = (eu?.vazasFeitas ?? 0) - (eu && eu.id === donoDoMonteOculto ? 1 : 0);

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
        <ul ref={adversariosRef} className="adversarios" aria-label="Adversários">
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
                onVerMao={jogador.maoRevelada ? () => definirMaoAbertaDe(jogador.id) : undefined}
              />
            );
          })}
        </ul>
      </div>

      <div className="palco">
        <section className="feltro" aria-label="Mesa">
          <div className="feltro__esquerda">
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
            <div className="feltro__manilha">
              <span className="rotulo-pequeno feltro__rotulo">Manilha</span>
              <strong className="feltro__manilha-valor">{jogo.manilha ?? '–'}</strong>
            </div>
            <MonteDeEmpates
              vazas={jogo.vazasEmpatadas}
              manilha={jogo.manilha}
              ocultarUltimo={donoDoMonteOculto === DESTINO_DOS_EMPATES}
            />
          </div>

          <div className="feltro__jogadas">
            {cartasNaMesa.length === 0 && !palpitando && (
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

          {/* Chamada de atenção a cada vez nova; a chave remonta o elemento e reinicia a animação. */}
          {souDaVez && !estouEliminado && (
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
              palpiteProibido={jogo.palpiteProibido}
              souOPe={jogo.idDoPe === meuId}
              vira={jogo.vira}
              manilha={jogo.manilha}
              palpitesAnteriores={palpitesAnteriores}
              depoisDeVoce={depoisDeVoce}
              prazoFinal={prazoFinal}
              ocupado={ocupado}
              onConfirmar={(quantidade) => void executar(() => palpitar(quantidade))}
            />
          )}
        </section>
      </div>

      <section
        className={classes('minha', podeJogar && !ocupado && 'minha--jogar')}
        aria-label="Minha área"
      >
        {/* O tutorial roda sem sala no servidor: não há para quem reagir. */}
        {tutorial === null && <ReacoesDaMesa meuId={meuId} />}
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
                souDaVez && emRodada ? 'neon neon--ciano' : 'minha__nome--apagado',
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
              feitas={minhasFeitas}
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
              ocultarUltimo={eu.id === donoDoMonteOculto}
              className="montes--minha"
            />
          )}
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

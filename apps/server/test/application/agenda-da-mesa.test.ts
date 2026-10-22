import type { SessaoJogador } from '@fodinha/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CARENCIA_MS,
  PAUSA_FIM_RODADA_MS,
  PRAZO_MS,
  ator,
  montarCenario,
  type Cenario,
} from '../apoio';

/**
 * Mudanças laterais na sala (entrar, cair e voltar, votar, mudar opção) não podem devolver o prazo
 * inteiro a quem está com a vez nem reiniciar a pausa entre rodadas; pausas congelam o restante.
 */

let c: Cenario;

beforeEach(() => {
  c = montarCenario();
});

/** Só humanos: a vez nunca é de bot, então o único passo automático é o prazo estourar. */
function mesaDeDoisHumanos() {
  const ana = c.criarSala();
  const bia = c.entrar(ana, 'Bia');
  c.servico.iniciarPartida(ator(ana));
  const daVez = [ana, bia].find((h) => c.partidaDe(h)?.idDaVez === h.jogadorId) as SessaoJogador;
  const outro = daVez === ana ? bia : ana;
  return { ana, daVez, outro };
}

/** Reconecta pelo mesmo navegador: o cenário usa `disp-<apelido>`. */
function voltar(sessao: SessaoJogador): void {
  const apelido = c.salaDe(sessao)?.participantes.find((p) => p.id === sessao.jogadorId)?.apelido;
  c.reconectar(sessao, `disp-${apelido?.toLowerCase()}`);
}

/** O prazo estoura exatamente em `instante`: um milissegundo antes, a vez ainda é de quem era. */
function esperarJogadaAutomaticaEm(instante: number, daVez: SessaoJogador): void {
  c.relogio.avancar(instante - 1 - c.relogio.agora());
  expect(c.partidaDe(daVez)?.idDaVez).toBe(daVez.jogadorId);
  c.relogio.avancar(1);
  expect(c.partidaDe(daVez)?.idDaVez).not.toBe(daVez.jogadorId);
}

describe('Agenda da mesa — prazo da vez', () => {
  it('naoDeveDevolverOPrazoAQuemCaiEVoltaNoMeioDaVez', () => {
    const { daVez } = mesaDeDoisHumanos();
    c.relogio.avancar(20_000);
    c.desconectar(daVez);
    c.relogio.avancar(CARENCIA_MS / 2);
    voltar(daVez);
    expect(c.partidaDe(daVez)?.prazoDaVezEm).toBe(PRAZO_MS);
    esperarJogadaAutomaticaEm(PRAZO_MS, daVez);
  });

  it('naoDeveDevolverOPrazoQuandoOutroHumanoEntra', () => {
    const { ana, daVez } = mesaDeDoisHumanos();
    c.relogio.avancar(20_000);
    c.entrar(ana, 'Carla');
    expect(c.partidaDe(daVez)?.prazoDaVezEm).toBe(PRAZO_MS);
    expect(c.partidaDe(daVez)?.prazoDaVezRestanteMs).toBe(PRAZO_MS - 20_000);
    esperarJogadaAutomaticaEm(PRAZO_MS, daVez);
  });

  it('deveManterOMesmoPrazoAoReagendarSemMudancaDeVez', () => {
    const { ana, daVez } = mesaDeDoisHumanos();
    c.relogio.avancar(5_000);
    for (let i = 0; i < 5; i++) {
      c.servico.definirMortosVeemCartas(ator(ana), i % 2 === 0);
      c.servico.republicar(ana.codigoSala);
    }
    expect(c.partidaDe(daVez)?.prazoDaVezEm).toBe(PRAZO_MS);
    esperarJogadaAutomaticaEm(PRAZO_MS, daVez);
  });

  it('deveDarPrazoInteiroAQuemRecebeAVez', () => {
    const { daVez, outro } = mesaDeDoisHumanos();
    c.relogio.avancar(12_000);
    c.servico.palpitar(ator(daVez), 0);
    expect(c.partidaDe(outro)?.idDaVez).toBe(outro.jogadorId);
    expect(c.partidaDe(outro)?.prazoDaVezEm).toBe(12_000 + PRAZO_MS);
  });
});

describe('Agenda da mesa — pausas', () => {
  it('deveContinuarDoQueRestavaQuandoODonoRetoma', () => {
    const { ana, daVez } = mesaDeDoisHumanos();
    c.relogio.avancar(10_000);
    c.servico.pausar(ator(ana));
    c.relogio.avancar(10 * PRAZO_MS);
    expect(c.partidaDe(daVez)?.idDaVez).toBe(daVez.jogadorId);

    c.servico.retomar(ator(ana));
    expect(c.partidaDe(daVez)?.prazoDaVezRestanteMs).toBe(PRAZO_MS - 10_000);
    esperarJogadaAutomaticaEm(c.relogio.agora() + PRAZO_MS - 10_000, daVez);
  });

  it('deveCongelarOPrazoDuranteAVotacaoDeEsperaPorAusente', () => {
    const { daVez, outro } = mesaDeDoisHumanos();
    c.relogio.avancar(5_000);
    c.desconectar(outro);
    // A carência corre com a mesa andando; a votação abre (e pausa) aos 15 s.
    c.relogio.avancar(CARENCIA_MS);
    expect(c.partidaDe(daVez)?.pausa?.votacoes).toHaveLength(1);
    c.relogio.avancar(45_000);

    voltar(outro);
    expect(c.partidaDe(daVez)?.pausa).toBeNull();
    // 15 s corridos antes da pausa: sobram 15 s.
    esperarJogadaAutomaticaEm(c.relogio.agora() + PRAZO_MS - 15_000, daVez);
  });

  it('deveContinuarDoQueRestavaDepoisDaLeituraDasRegras', () => {
    const { daVez, outro } = mesaDeDoisHumanos();
    c.relogio.avancar(10_000);
    c.servico.lerRegras(ator(outro));
    c.relogio.avancar(20_000);
    c.servico.pararDeLerRegras(ator(outro));
    esperarJogadaAutomaticaEm(c.relogio.agora() + PRAZO_MS - 10_000, daVez);
  });
});

describe('Agenda da mesa — fim de rodada', () => {
  /** A primeira rodada é cega: palpitados os dois, as cartas vão sozinhas à mesa e ela acaba. */
  function terminarARodada() {
    const mesa = mesaDeDoisHumanos();
    c.humanosJogam([mesa.daVez, mesa.outro]);
    expect(c.partidaDe(mesa.ana)?.fase).toBe('fim_de_rodada');
    return mesa;
  }

  it('deveComecarAProximaRodadaNoInstanteOriginalMesmoComAlguemEntrando', () => {
    const { ana } = terminarARodada();
    const fim = c.relogio.agora();
    c.relogio.avancar(1_500);
    c.entrar(ana, 'Carla');
    expect(c.partidaDe(ana)?.proximaRodada?.comecaEmMs).toBe(PAUSA_FIM_RODADA_MS - 1_500);

    c.relogio.avancar(fim + PAUSA_FIM_RODADA_MS - 1 - c.relogio.agora());
    expect(c.partidaDe(ana)?.fase).toBe('fim_de_rodada');
    c.relogio.avancar(1);
    expect(c.partidaDe(ana)?.fase).toBe('palpites');
    expect(c.partidaDe(ana)?.numeroRodada).toBe(2);
  });

  it('naoDeveReiniciarAPausaQuandoAlguemCaiEVoltaNoIntervalo', () => {
    const { ana, outro } = terminarARodada();
    const fim = c.relogio.agora();
    c.relogio.avancar(1_000);
    c.desconectar(outro);
    c.relogio.avancar(1_000);
    voltar(outro);

    c.relogio.avancar(fim + PAUSA_FIM_RODADA_MS - 1 - c.relogio.agora());
    expect(c.partidaDe(ana)?.fase).toBe('fim_de_rodada');
    c.relogio.avancar(1);
    expect(c.partidaDe(ana)?.numeroRodada).toBe(2);
  });
});

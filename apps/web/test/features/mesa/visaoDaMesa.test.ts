import { describe, expect, it } from 'vitest';
import {
  CONFIGURACAO_PADRAO,
  type EstadoPartidaVisivel,
  type EstadoSala,
  type JogadorVisivel,
  type PausaVisivel,
} from '@fodinha/shared';
import {
  idDaVezAtiva,
  somaDosPalpites,
  visaoDaMesa,
  type EntradaDaVisao,
} from '../../../src/features/mesa/visaoDaMesa';

const EU = 'eu';
const RECEBIDO_EM = 1_000;
const PAUSA_DO_DONO: PausaVisivel = { votacoes: [], pausadaPeloDono: true, lendoRegras: null };

function jogador(id: string, campos: Partial<JogadorVisivel> = {}): JogadorVisivel {
  return {
    id,
    apelido: id === EU ? 'Eu Mesmo' : `${id.toUpperCase()} Silva`,
    ehBot: false,
    conectado: true,
    vidas: 5,
    eliminado: false,
    palpite: null,
    vazasFeitas: 0,
    vazasGanhas: [],
    cartasNaMao: 3,
    cartaNaTesta: null,
    maoRevelada: null,
    saiAoFimDaRodada: false,
    ...campos,
  };
}

/** Mesa de 4 na ordem a (mão), b, eu, d (pé), 3 cartas, ninguém palpitou ainda. */
function partida(campos: Partial<EstadoPartidaVisivel> = {}): EstadoPartidaVisivel {
  return {
    configuracao: CONFIGURACAO_PADRAO,
    fase: 'palpites',
    numeroRodada: 2,
    cartasPorJogador: 3,
    rodadaCega: false,
    vira: null,
    manilha: '5',
    jogadores: [jogador('a'), jogador('b'), jogador(EU), jogador('d')],
    idDoPe: 'd',
    idDoPrimeiro: 'a',
    idDaVez: 'a',
    prazoDaVezEm: null,
    prazoDaVezRestanteMs: 20_000,
    minhaMao: [],
    mesa: [],
    ultimaVaza: null,
    vazasEmpatadas: [],
    palpiteProibido: null,
    resultadoRodada: null,
    proximaRodada: null,
    vencedores: [],
    pausa: null,
    ...campos,
  };
}

function visao(jogo: EstadoPartidaVisivel, extra: Partial<EntradaDaVisao> = {}) {
  return visaoDaMesa({ jogo, sala: null, meuId: EU, recebidoEm: RECEBIDO_EM, ...extra });
}

function sala(aguardando: boolean): EstadoSala {
  return {
    codigo: 'ABCD',
    configuracao: CONFIGURACAO_PADRAO,
    emPartida: true,
    participantes: [
      {
        id: EU,
        apelido: 'Eu Mesmo',
        ehBot: false,
        conectado: true,
        ehAnfitriao: false,
        aguardandoProximaRodada: aguardando,
        saindo: false,
      },
    ],
  };
}

describe('idDaVezAtiva', () => {
  it('deveDevolverQuemEstaComAVezNaRodadaSolta', () => {
    expect(idDaVezAtiva(partida({ fase: 'palpites', idDaVez: 'b' }))).toBe('b');
    expect(idDaVezAtiva(partida({ fase: 'jogando', idDaVez: EU }))).toBe(EU);
  });

  it('naoDeveHaverVezComAMesaPausada', () => {
    expect(idDaVezAtiva(partida({ idDaVez: 'b', pausa: PAUSA_DO_DONO }))).toBeNull();
  });

  it('naoDeveHaverVezForaDaRodada', () => {
    expect(idDaVezAtiva(partida({ fase: 'fim_de_rodada', idDaVez: 'b' }))).toBeNull();
    expect(idDaVezAtiva(partida({ fase: 'encerrada', idDaVez: 'b' }))).toBeNull();
  });
});

describe('visaoDaMesa — vez', () => {
  it('deveDeixarEuPalpitarNaMinhaVezDePalpite', () => {
    const v = visao(partida({ idDaVez: EU }));
    expect(v).toMatchObject({ souDaVez: true, palpitando: true, podeJogar: false, devoAgir: true });
    expect(v.prazoFinal).toBe(RECEBIDO_EM + 20_000);
  });

  it('deveDeixarEuJogarNaMinhaVezDeJogo', () => {
    const v = visao(partida({ fase: 'jogando', idDaVez: EU }));
    expect(v).toMatchObject({ souDaVez: true, palpitando: false, podeJogar: true });
    expect(v.apagarMao).toBe(false);
  });

  it('deveApagarAMaoQuandoAVezDeJogoEDeOutro', () => {
    const v = visao(partida({ fase: 'jogando', idDaVez: 'b' }));
    expect(v).toMatchObject({ souDaVez: false, podeJogar: false, apagarMao: true, idDaVez: 'b' });
  });

  it('naoDeveDarAVezANinguemNaPausa', () => {
    const v = visao(partida({ fase: 'jogando', idDaVez: EU, pausa: PAUSA_DO_DONO }));
    expect(v).toMatchObject({
      pausado: true,
      idDaVez: null,
      souDaVez: false,
      podeJogar: false,
      devoAgir: false,
      prazoFinal: null,
    });
  });

  it('naoDeveTerPrazoQuandoASalaNaoTemLimite', () => {
    expect(visao(partida({ idDaVez: EU, prazoDaVezRestanteMs: null })).prazoFinal).toBeNull();
  });

  it('naoDeveTerVezNoFimDaRodadaNemComAPartidaEncerrada', () => {
    for (const fase of ['fim_de_rodada', 'encerrada'] as const) {
      const v = visao(partida({ fase, idDaVez: null }));
      expect(v).toMatchObject({ emRodada: false, souDaVez: false, palpitando: false });
      expect(v.podeJogar).toBe(false);
    }
  });
});

describe('visaoDaMesa — situação', () => {
  it('deveAvisarQuemEntraNaProximaRodada', () => {
    const v = visao(partida({ idDaVez: EU }), { sala: sala(true) });
    expect(v.situacao).toEqual({
      tipo: 'aguardandoProximaRodada',
      texto: 'Você entra na próxima rodada',
    });
  });

  it('deveAvisarAPausa', () => {
    const v = visao(partida({ pausa: PAUSA_DO_DONO }));
    expect(v.situacao).toEqual({ tipo: 'pausada', texto: 'Partida pausada' });
  });

  it('deveAvisarOFimDaRodada', () => {
    const v = visao(partida({ fase: 'fim_de_rodada', idDaVez: null }));
    expect(v.situacao).toEqual({ tipo: 'fimDaRodada', texto: 'Fim da rodada' });
  });

  it('deveDizerQueEMinhaVezDePalpitarOuJogar', () => {
    expect(visao(partida({ idDaVez: EU })).situacao).toEqual({
      tipo: 'minhaVez',
      texto: 'Sua vez de palpitar',
    });
    expect(visao(partida({ fase: 'jogando', idDaVez: EU })).situacao.texto).toBe(
      'Sua vez de jogar',
    );
  });

  it('deveDizerSoOPrimeiroNomeDeQuemEstaComAVez', () => {
    expect(visao(partida({ idDaVez: 'b' })).situacao).toEqual({
      tipo: 'vezDeOutro',
      texto: 'Vez de B palpitar',
    });
    expect(visao(partida({ fase: 'jogando', idDaVez: 'b' })).situacao.texto).toBe('Vez de B jogar');
  });

  it('deveAguardarQuandoNinguemEstaComAVez', () => {
    const v = visao(partida({ fase: 'encerrada', idDaVez: null }));
    expect(v.situacao).toEqual({ tipo: 'aguardando', texto: 'Aguardando…' });
  });
});

describe('visaoDaMesa — palpite', () => {
  it('deveListarQuemPalpitouAntesDeMimEQuantosFaltamDepois', () => {
    const jogo = partida({
      idDaVez: EU,
      jogadores: [
        jogador('a', { palpite: 1 }),
        jogador('b', { palpite: 0 }),
        jogador(EU),
        jogador('d'),
      ],
    });
    const { palpite } = visao(jogo);
    expect(palpite.anteriores).toEqual([
      { id: 'a', nome: 'A Silva', palpite: 1, ehMao: true },
      { id: 'b', nome: 'B Silva', palpite: 0, ehMao: false },
    ]);
    expect(palpite).toMatchObject({ depoisDeVoce: 1, soma: 1, palpitaram: 2, vivos: 4 });
    expect(palpite.souOPe).toBe(false);
  });

  it('deveRefletirQueOPeNaoPodeFecharASoma', () => {
    // Pediram 2 de 3: o pé não pode dizer 1, senão a soma fecha.
    const jogo = partida({
      jogadores: [
        jogador('a', { palpite: 1 }),
        jogador('b', { palpite: 1 }),
        jogador(EU, { palpite: 0 }),
        jogador('d'),
      ],
      idDaVez: 'd',
      palpiteProibido: 1,
    });
    const doPe = visaoDaMesa({ jogo, sala: null, meuId: 'd', recebidoEm: RECEBIDO_EM });
    expect(doPe.palpite).toMatchObject({ souOPe: true, proibido: 1, soma: 2, depoisDeVoce: 0 });
    expect(doPe.palpite.anteriores.map((anterior) => anterior.id)).toEqual(['a', 'b', EU]);
  });

  it('deveIgnorarOsEliminadosNaSomaENaOrdem', () => {
    const jogadores = [
      jogador('a', { palpite: 2 }),
      jogador('b', { eliminado: true, palpite: 3 }),
      jogador(EU),
      jogador('d'),
    ];
    expect(somaDosPalpites(jogadores)).toBe(2);
    const v = visao(partida({ jogadores, idDaVez: EU }));
    expect(v.palpite).toMatchObject({ soma: 2, vivos: 3, depoisDeVoce: 1 });
    expect(v.vivosNaMesa).toBe(3);
    expect(v.adversarios.map((j) => j.id)).toEqual(['a', 'd', 'b']);
  });

  it('deveRotularMaoEPeSoNoPrimeiroPalpiteDaPartida', () => {
    expect(visao(partida({ numeroRodada: 1 })).rotularMaoEPe).toBe(true);
    expect(visao(partida({ numeroRodada: 1, fase: 'jogando' })).rotularMaoEPe).toBe(false);
    expect(visao(partida({ numeroRodada: 2 })).rotularMaoEPe).toBe(false);
  });
});

describe('visaoDaMesa — contadores', () => {
  it('deveContarAVazaEmDisputaComAsAnuladas', () => {
    const carta = { id: 'x', valor: '4', naipe: 'paus' } as const;
    const jogo = partida({
      fase: 'jogando',
      jogadores: [
        jogador('a', { vazasFeitas: 1 }),
        jogador('b'),
        jogador(EU, { vazasFeitas: 1 }),
        jogador('d'),
      ],
      vazasEmpatadas: [{ cartaDoTopo: carta, quantidadeDeCartas: 4 }],
    });
    const v = visao(jogo);
    expect(v.vazaAtual).toBe(3);
    expect(v.minhasFeitas).toBe(1);
  });

  it('naoDevePassarDaUltimaVazaQuandoTodasForamDecididas', () => {
    const jogo = partida({
      fase: 'fim_de_rodada',
      idDaVez: null,
      jogadores: [
        jogador('a', { vazasFeitas: 2 }),
        jogador('b'),
        jogador(EU, { vazasFeitas: 1 }),
        jogador('d'),
      ],
    });
    expect(visao(jogo).vazaAtual).toBe(3);
  });
});

describe('visaoDaMesa — espectador e eliminado', () => {
  it('deveTratarQuemNaoTemAssentoComoAguardandoAProximaRodada', () => {
    const v = visaoDaMesa({
      jogo: partida({ idDaVez: 'a' }),
      sala: null,
      meuId: 'novato',
      recebidoEm: RECEBIDO_EM,
    });
    expect(v).toMatchObject({
      eu: undefined,
      aguardandoProximaRodada: true,
      estouEliminado: false,
      minhasFeitas: 0,
    });
    expect(v.palpite).toMatchObject({ anteriores: [], depoisDeVoce: 0 });
    expect(v.adversarios).toHaveLength(4);
  });

  it('deveSeguirOQueASalaDizSobreQuemAguarda', () => {
    expect(visao(partida(), { sala: sala(false) }).aguardandoProximaRodada).toBe(false);
  });

  it('naoDeveDeixarOEliminadoAgir', () => {
    const jogo = partida({
      fase: 'jogando',
      idDaVez: EU,
      jogadores: [jogador('a'), jogador('b'), jogador(EU, { eliminado: true }), jogador('d')],
    });
    const v = visao(jogo);
    expect(v).toMatchObject({ estouEliminado: true, podeJogar: false, devoAgir: false });
  });

  it('deveNomearOJogadorComoVoceParaMim', () => {
    const v = visao(partida());
    expect(v.nomeDe(EU)).toBe('Você');
    expect(v.nomeDe('a')).toBe('A Silva');
    expect(v.nomeDe('sumiu')).toBe('Jogador');
    expect(v.nomeDe(null)).toBeNull();
  });
});

import { CONFIGURACAO_PADRAO } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { Partida } from '../../src/domain/partida';
import { geradorComSemente } from '../apoio';

const JOGADORES = ['j0', 'j1', 'j2', 'j3'];
// 1 baralho sem 8-9-10 tem 40 cartas: 4 jogadores comportam até floor((40 - 1) / 4) = 9.
const MAXIMO_COM_4_JOGADORES = 9;

function iniciarCom(cartasNaPrimeiraRodada?: number): Partida {
  return Partida.iniciar({
    configuracao: CONFIGURACAO_PADRAO,
    jogadorIds: JOGADORES,
    gerarAleatorio: geradorComSemente(7),
    cartasNaPrimeiraRodada,
  });
}

describe('Partida — cartasNaPrimeiraRodada', () => {
  it('deveDistribuirAQuantidadePedidaNaPrimeiraRodada', () => {
    const partida = iniciarCom(4);
    const visao = partida.visaoPara('j0');

    expect(visao.numeroRodada).toBe(1);
    expect(visao.cartasPorJogador).toBe(4);
    expect(visao.minhaMao).toHaveLength(4);
  });

  it('deveLimitarAoMaximoPossivelQuandoPedirMais', () => {
    const partida = iniciarCom(99);

    expect(partida.visaoPara('j0').cartasPorJogador).toBe(MAXIMO_COM_4_JOGADORES);
  });

  it('deveComecarComUmaCartaQuandoNaoInformado', () => {
    expect(iniciarCom().visaoPara('j0').cartasPorJogador).toBe(1);
  });
});

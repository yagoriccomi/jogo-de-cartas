import { CONFIGURACAO_PADRAO } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import {
  lerCarta,
  lerCenario,
  lerConfiguracao,
  lerCriacao,
  lerEntrada,
  lerExpulsao,
  lerMortosVeemCartas,
  lerPalpite,
  lerReacao,
  lerReconexao,
  lerVoto,
} from '../../src/infrastructure/socket/entradas';

const comCodigo = (codigo: string) => expect.objectContaining({ codigo });
const invalida = comCodigo('ENTRADA_INVALIDA');
const IDENTIFICACAO = { apelido: 'Ana', dispositivoId: 'disp-ana' };

describe('entradas do socket', () => {
  it.each([null, undefined, 'texto', 42])('deveRecusarCorpoQueNaoEObjeto (%s)', (corpo) => {
    expect(() => lerEntrada(corpo)).toThrow(invalida);
    expect(() => lerPalpite(corpo)).toThrow(invalida);
  });

  it('deveDevolverSoOsCamposConhecidosDaCriacao', () => {
    const lido = lerCriacao({ ...IDENTIFICACAO, configuracao: CONFIGURACAO_PADRAO, extra: 1 });
    expect(lido).toEqual({ ...IDENTIFICACAO, configuracao: CONFIGURACAO_PADRAO });
  });

  it('deveExigirApelidoEDispositivoComoTexto', () => {
    const configuracao = CONFIGURACAO_PADRAO;
    expect(() => lerCriacao({ apelido: 7, dispositivoId: 'd', configuracao })).toThrow(invalida);
    expect(() => lerCriacao({ apelido: 'Ana', configuracao })).toThrow(invalida);
    expect(() => lerCriacao({ ...IDENTIFICACAO, configuracao: 'padrão' })).toThrow(invalida);
  });

  it('deveExigirCodigoDaSalaComoTexto', () => {
    expect(lerEntrada({ ...IDENTIFICACAO, codigoSala: 'abcd' }).codigoSala).toBe('abcd');
    expect(() => lerEntrada({ ...IDENTIFICACAO, codigoSala: 1234 })).toThrow(invalida);
  });

  it('deveTratarTokenQueNaoETextoComoSessaoExpirada', () => {
    const dados = { codigoSala: 'ABCD', dispositivoId: 'd' };
    expect(lerReconexao({ ...dados, tokenSessao: 't' }).tokenSessao).toBe('t');
    expect(() => lerReconexao({ ...dados, tokenSessao: 99 })).toThrow(comCodigo('SEM_PERMISSAO'));
  });

  it('deveExigirQuantidadesNumericasNoCenario', () => {
    expect(lerCenario({ ...IDENTIFICACAO, jogadores: 3, cartas: 2 })).toMatchObject({
      jogadores: 3,
      cartas: 2,
    });
    expect(() => lerCenario({ ...IDENTIFICACAO, jogadores: 3, cartas: '3' })).toThrow(invalida);
  });

  it('deveValidarAConfiguracaoEAOpcaoDosEliminados', () => {
    expect(lerConfiguracao({ configuracao: CONFIGURACAO_PADRAO })).toEqual(CONFIGURACAO_PADRAO);
    expect(() => lerConfiguracao({})).toThrow(invalida);
    expect(lerMortosVeemCartas({ permitir: true })).toBe(true);
    expect(() => lerMortosVeemCartas({ permitir: 'sim' })).toThrow(invalida);
  });

  it('deveExigirIdsComoTexto', () => {
    expect(lerExpulsao({ participanteId: 'p1' })).toBe('p1');
    expect(() => lerExpulsao({ participanteId: 1 })).toThrow(invalida);
    expect(lerCarta({ cartaId: 'c1' })).toBe('c1');
    expect(() => lerCarta({ cartaId: 1 })).toThrow(comCodigo('JOGADA_INVALIDA'));
  });

  it('deveExigirVotoComAusenteEDecisao', () => {
    expect(lerVoto({ ausenteId: 'a', esperar: false })).toEqual({ ausenteId: 'a', esperar: false });
    expect(() => lerVoto({ ausenteId: 'a', esperar: 'não' })).toThrow(invalida);
  });

  it('deveExigirPalpiteNumerico', () => {
    expect(lerPalpite({ quantidade: 2 })).toBe(2);
    expect(() => lerPalpite({ quantidade: '2' })).toThrow(comCodigo('PALPITE_INVALIDO'));
  });

  it('deveAceitarSoReacoesDaLista', () => {
    expect(lerReacao({ reacao: '🔥' })).toBe('🔥');
    expect(() => lerReacao({ reacao: '💩' })).toThrow(invalida);
    expect(() => lerReacao({ reacao: 42 })).toThrow(invalida);
  });
});

import { CONFIGURACAO_PADRAO } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import { validarConfiguracao } from '../../src/domain/configuracao';
import type { Partida } from '../../src/domain/partida';
import { projetarSala } from '../../src/domain/projecao';
import { Sala, type Participante } from '../../src/domain/sala';
import { criarPartida, geradorComSemente, jogarRodadaAteOFim } from '../apoio';

const COM_OPCAO = { ...CONFIGURACAO_PADRAO, mortosVeemCartas: true };

/** j1 é votado para fora na rodada 1 e já está eliminado quando a rodada 2 é distribuída. */
function partidaComEliminado(configuracao = COM_OPCAO): Partida {
  const partida = criarPartida(4, 9, configuracao);
  partida.agendarSaida('j1', 'eliminar');
  jogarRodadaAteOFim(partida);
  partida.iniciarProximaRodada();
  return partida;
}

function humano(id: string): Participante {
  return {
    id,
    apelido: id,
    ehBot: false,
    perfilDoBot: null,
    conectado: true,
    tokenSessao: `token-${id}`,
    dispositivoId: `disp-${id}`,
  };
}

describe('mortos veem cartas — partida', () => {
  it('deveMostrarAoEliminadoAMaoDosOutrosQuandoAOpcaoEstaLigada', () => {
    const partida = partidaComEliminado();
    const visao = partida.visaoPara('j1');
    expect(visao.jogadores.find((j) => j.id === 'j1')?.eliminado).toBe(true);
    for (const id of ['j0', 'j2', 'j3']) {
      const revelada = visao.jogadores.find((j) => j.id === id)?.maoRevelada;
      expect(revelada?.map((c) => c.id).sort()).toEqual(
        partida
          .cartasNaMaoDe(id)
          .map((c) => c.id)
          .sort(),
      );
    }
    expect(visao.jogadores.find((j) => j.id === 'j1')?.maoRevelada).toBeNull();
  });

  it('naoDeveMostrarMaoAlheiaAoEliminadoComAOpcaoDesligada', () => {
    const visao = partidaComEliminado(CONFIGURACAO_PADRAO).visaoPara('j1');
    expect(visao.jogadores.every((j) => j.maoRevelada === null)).toBe(true);
  });

  it('nuncaDeveMostrarMaoAlheiaAJogadorVivoNemAEspectador', () => {
    const partida = partidaComEliminado();
    for (const observador of ['j0', 'j2', 'j3', null]) {
      const visao = partida.visaoPara(observador);
      expect(visao.jogadores.every((j) => j.maoRevelada === null)).toBe(true);
    }
  });

  it('deveRespeitarAMudancaDaOpcaoNoMeioDaPartida', () => {
    const partida = partidaComEliminado(CONFIGURACAO_PADRAO);
    partida.definirMortosVeemCartas(true);
    expect(partida.visaoPara('j1').jogadores.some((j) => j.maoRevelada !== null)).toBe(true);
    partida.definirMortosVeemCartas(false);
    expect(partida.visaoPara('j1').jogadores.every((j) => j.maoRevelada === null)).toBe(true);
  });
});

describe('mortos veem cartas — sala', () => {
  it('deveVirDesligadaEAceitarConfiguracaoDeClienteAntigoSemOCampo', () => {
    expect(CONFIGURACAO_PADRAO.mortosVeemCartas).toBe(false);
    const { quantidadeBaralhos, vidasIniciais, incluirOitoNoveDez } = CONFIGURACAO_PADRAO;
    expect(
      validarConfiguracao({ quantidadeBaralhos, vidasIniciais, incluirOitoNoveDez })
        .mortosVeemCartas,
    ).toBe(false);
  });

  it('deveDeixarSoODonoTrocarAOpcaoInclusiveEmPartida', () => {
    const sala = new Sala('ABCD', humano('dono'), CONFIGURACAO_PADRAO);
    sala.adicionarHumano(humano('bia'));
    sala.iniciarPartida('dono', geradorComSemente(1));

    expect(() => sala.definirMortosVeemCartas('bia', true)).toThrow('Só o dono');
    expect(projetarSala(sala).configuracao.mortosVeemCartas).toBe(false);

    sala.definirMortosVeemCartas('dono', true);
    expect(projetarSala(sala).configuracao.mortosVeemCartas).toBe(true);
    expect(sala.partida?.visaoPara('dono').configuracao.mortosVeemCartas).toBe(true);
  });
});

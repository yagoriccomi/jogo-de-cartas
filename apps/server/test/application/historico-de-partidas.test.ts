import type { SessaoJogador } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import type { RegistroDePartidas } from '../../src/application/portas';
import { RegistroDePartidasEmMemoria } from '../../src/infrastructure/historico/registro-em-memoria';
import { ATRASO_BOT_MS, ator, montarCenario, PAUSA_FIM_RODADA_MS, type Cenario } from '../apoio';

const PASSOS_ATE_O_FIM = 400;

/** Ana contra dois bots, partida iniciada. */
function mesaComBots(registro?: RegistroDePartidas) {
  const registroUsado = registro ?? new RegistroDePartidasEmMemoria();
  const cenario = montarCenario({}, undefined, undefined, registroUsado);
  const ana = cenario.criarSala('Ana');
  cenario.servico.adicionarBot(ator(ana));
  cenario.servico.adicionarBot(ator(ana));
  cenario.servico.iniciarPartida(ator(ana));
  return { cenario, ana };
}

function jogarAteOFim(cenario: Cenario, ana: SessaoJogador): void {
  for (let passo = 0; passo < PASSOS_ATE_O_FIM; passo++) {
    if (cenario.partidaDe(ana)?.fase === 'encerrada') return;
    cenario.humanosJogam([ana]);
    cenario.relogio.avancar(ATRASO_BOT_MS + PAUSA_FIM_RODADA_MS);
  }
  throw new Error('a partida não terminou');
}

function exigirMemoria(cenario: Cenario): RegistroDePartidasEmMemoria {
  const { registro } = cenario;
  if (!(registro instanceof RegistroDePartidasEmMemoria)) throw new Error('registro inesperado');
  return registro;
}

describe('Histórico das partidas na aplicação', () => {
  it('uma partida completa grava o início, uma linha por rodada e o fim', async () => {
    const { cenario, ana } = mesaComBots();
    jogarAteOFim(cenario, ana);
    await cenario.historico.aguardarGravacoes();

    const partidas = [...exigirMemoria(cenario).partidas.values()];
    expect(partidas).toHaveLength(1);
    const [partida] = partidas as [(typeof partidas)[number]];
    const rodadas = cenario.partidaDe(ana)?.numeroRodada ?? 0;
    expect(partida.rodadas.map((r) => r.rodada.numero)).toEqual(
      Array.from({ length: rodadas }, (_, i) => i + 1),
    );
    expect(partida.inicio.participantes.map((p) => p.tipo).sort()).toEqual([
      'bot',
      'bot',
      'humano',
    ]);
    expect(partida.inicio.participantes.every((p) => p.tipo === 'humano' || p.perfil)).toBe(true);
    expect(partida.fim?.desfecho.motivo).toBe('fim');
    expect(partida.fim?.desfecho.rodadasJogadas).toBe(rodadas);
    expect(cenario.errosDoHistorico).toEqual([]);
  });

  it('nenhum apelido chega ao registro', async () => {
    const { cenario, ana } = mesaComBots();
    jogarAteOFim(cenario, ana);
    await cenario.historico.aguardarGravacoes();
    const gravado = JSON.stringify([...exigirMemoria(cenario).partidas.values()]);
    for (const { apelido } of cenario.salaDe(ana)?.participantes ?? []) {
      expect(gravado).not.toContain(apelido);
    }
  });

  it('cenário de teste não grava nada', async () => {
    const cenario = montarCenario();
    const ana = cenario.servico.criarCenario({
      apelido: 'Ana',
      dispositivoId: 'disp-ana',
      jogadores: 3,
      cartas: 2,
    });
    jogarAteOFim(cenario, ana);
    await cenario.historico.aguardarGravacoes();
    expect(exigirMemoria(cenario).partidas.size).toBe(0);
  });

  it('reiniciar encerra a partida anterior como interrompida e abre outra', async () => {
    const { cenario, ana } = mesaComBots();
    cenario.jogarAteNovaRodada([ana], ana);
    cenario.servico.reiniciar(ator(ana));
    await cenario.historico.aguardarGravacoes();
    const [primeira, segunda] = [...exigirMemoria(cenario).partidas.values()];
    expect(primeira?.rodadas.length).toBeGreaterThan(0);
    expect(primeira?.fim?.desfecho.motivo).toBe('interrompida');
    expect(segunda?.fim).toBeNull();
  });

  it('a sala que some deixa a partida como abandonada', async () => {
    const { cenario, ana } = mesaComBots();
    cenario.jogarAteNovaRodada([ana], ana);
    cenario.servico.sair(ator(ana));
    await cenario.historico.aguardarGravacoes();
    const [partida] = [...exigirMemoria(cenario).partidas.values()];
    expect(partida?.fim?.desfecho.motivo).toBe('abandonada');
  });

  it('falha do gravador não interrompe a partida nem muda o que o cliente recebe', async () => {
    const quebrado: RegistroDePartidas = {
      iniciarPartida: () => {
        throw new Error('banco fora do ar');
      },
      gravarRodada: () => Promise.reject(new Error('banco fora do ar')),
      encerrarPartida: () => Promise.reject(new Error('banco fora do ar')),
    };
    const comFalha = mesaComBots(quebrado);
    jogarAteOFim(comFalha.cenario, comFalha.ana);
    await comFalha.cenario.historico.aguardarGravacoes();

    const semFalha = mesaComBots();
    jogarAteOFim(semFalha.cenario, semFalha.ana);

    expect(comFalha.cenario.partidaDe(comFalha.ana)?.fase).toBe('encerrada');
    expect(comFalha.cenario.errosDoHistorico.length).toBeGreaterThan(0);
    expect(comFalha.cenario.partidaDe(comFalha.ana)).toEqual(
      semFalha.cenario.partidaDe(semFalha.ana),
    );
    expect(comFalha.cenario.salaDe(comFalha.ana)).toEqual(semFalha.cenario.salaDe(semFalha.ana));
  });
});

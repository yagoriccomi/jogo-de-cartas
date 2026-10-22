import { describe, expect, it } from 'vitest';
import { EstrategiaDoBot } from '../../src/domain/estrategia-bot';
import { geradorComSemente } from '../apoio';
import { EstrategiaAnterior } from './estrategia-anterior';
import { simular, vidasPorRodada } from './simulador';

// Pares de partidas espelhadas. Para ajustar as constantes do bot, rode com mais:
// SIMULACAO_PARES=2000 npx vitest run test/simulacao
const PARES = Number(process.env.SIMULACAO_PARES ?? 150);
// A margem de erro do bot também roda na simulação: ela faz parte de como ele joga.
const DESLOCAMENTO_DA_SEMENTE_DO_ERRO = 10_000;

describe('Simulação: bot novo contra o anterior', () => {
  it('perde menos vidas por rodada e vence mais partidas', () => {
    const resultado = simular(PARES, {
      novo: (semente) =>
        new EstrategiaDoBot(geradorComSemente(semente + DESLOCAMENTO_DA_SEMENTE_DO_ERRO)),
      antigo: () => new EstrategiaAnterior(),
    });

    const novo = vidasPorRodada(resultado.novo);
    const antigo = vidasPorRodada(resultado.antigo);
    console.info(
      `[simulação] ${resultado.partidas} partidas · vidas/rodada: novo ${novo.toFixed(3)}, ` +
        `anterior ${antigo.toFixed(3)} · vitórias: novo ${resultado.novo.vitorias.toFixed(1)}, ` +
        `anterior ${resultado.antigo.vitorias.toFixed(1)}`,
    );

    expect(novo).toBeLessThan(antigo);
    expect(resultado.novo.vitorias).toBeGreaterThan(resultado.antigo.vitorias);
  }, 120_000);
});

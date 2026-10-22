import { describe, expect, it } from 'vitest';
import { NOMES_DOS_PERFIS, PERFIS_DE_BOT, type PerfilDeBot } from '../../src/domain/bot/perfis';
import { EstrategiaDoBot } from '../../src/domain/estrategia-bot';
import { geradorComSemente } from '../apoio';
import { EstrategiaAnterior } from './estrategia-anterior';
import { simular, vidasPorRodada, type ResultadoDaSimulacao } from './simulador';

// Pares de partidas espelhadas por mesa. Para ajustar as constantes do bot, rode com mais:
// SIMULACAO_PARES=2000 npx vitest run test/simulacao
const PARES = Number(process.env.SIMULACAO_PARES ?? 100);
// A margem de erro do bot também roda na simulação: ela faz parte de como ele joga.
const DESLOCAMENTO_DA_SEMENTE_DO_ERRO = 10_000;

function perfil(nome: PerfilDeBot) {
  return (semente: number) =>
    new EstrategiaDoBot(geradorComSemente(semente + DESLOCAMENTO_DA_SEMENTE_DO_ERRO), nome);
}

function relatar(titulo: string, resultado: ResultadoDaSimulacao): void {
  process.stdout.write(
    `[simulação] ${titulo} · ${resultado.partidas} partidas · vidas/rodada: ` +
      `${vidasPorRodada(resultado.novo).toFixed(3)} contra ${vidasPorRodada(resultado.antigo).toFixed(3)} · ` +
      `vitórias: ${resultado.novo.vitorias.toFixed(1)} contra ${resultado.antigo.vitorias.toFixed(1)}
`,
  );
}

describe('Simulação — mesa de 3 jogadores (o mínimo usual)', () => {
  it.each(PERFIS_DE_BOT)(
    'o perfil %s perde menos vidas e vence mais que o bot anterior',
    (nome) => {
      const resultado = simular(
        { pares: PARES, jogadores: 3 },
        { novo: perfil(nome), antigo: () => new EstrategiaAnterior() },
      );
      relatar(`3j ${NOMES_DOS_PERFIS[nome]} × anterior`, resultado);

      expect(vidasPorRodada(resultado.novo)).toBeLessThan(vidasPorRodada(resultado.antigo));
      expect(resultado.novo.vitorias).toBeGreaterThan(resultado.antigo.vitorias);
    },
    120_000,
  );
});

// Na mesa de 10 com um baralho as rodadas têm de 1 a 3 cartas e quase não há o que decidir: os
// dois bots perdem perto do mínimo possível. O estilo pode custar um pouco, mas não muito.
const TOLERANCIA_DE_VIDAS_NA_MESA_CHEIA = 1.1;
const FRACAO_MINIMA_DE_VITORIAS_NA_MESA_CHEIA = 0.45;

describe('Simulação — mesa de 10 jogadores (a mesa cheia)', () => {
  it('o perfil equilibrado vence mais que o bot anterior sem perder mais vidas', () => {
    const resultado = simular(
      { pares: PARES, jogadores: 10 },
      { novo: perfil('equilibrado'), antigo: () => new EstrategiaAnterior() },
    );
    relatar('10j Equilibrado × anterior', resultado);

    expect(vidasPorRodada(resultado.novo)).toBeLessThan(
      vidasPorRodada(resultado.antigo) * TOLERANCIA_DE_VIDAS_NA_MESA_CHEIA,
    );
    expect(resultado.novo.vitorias).toBeGreaterThan(resultado.antigo.vitorias);
  }, 120_000);

  it.each(PERFIS_DE_BOT)(
    'o perfil %s não fica muito atrás do bot anterior',
    (nome) => {
      const resultado = simular(
        { pares: PARES, jogadores: 10 },
        { novo: perfil(nome), antigo: () => new EstrategiaAnterior() },
      );
      relatar(`10j ${NOMES_DOS_PERFIS[nome]} × anterior`, resultado);

      expect(vidasPorRodada(resultado.novo)).toBeLessThan(
        vidasPorRodada(resultado.antigo) * TOLERANCIA_DE_VIDAS_NA_MESA_CHEIA,
      );
      expect(resultado.novo.vitorias / resultado.partidas).toBeGreaterThan(
        FRACAO_MINIMA_DE_VITORIAS_NA_MESA_CHEIA,
      );
    },
    120_000,
  );
});

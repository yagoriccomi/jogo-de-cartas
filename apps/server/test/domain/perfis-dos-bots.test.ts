import { CONFIGURACAO_PADRAO } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import {
  GRUPOS_DE_PERFIS,
  MAXIMO_DO_MESMO_GRUPO,
  PERFIS_DE_BOT,
  sortearPerfis,
  type PerfilDeBot,
} from '../../src/domain/bot/perfis';
import { Sala, type Participante } from '../../src/domain/sala';
import { geradorComSemente } from '../apoio';

const SORTEIOS = 600;

function grupoDe(perfil: PerfilDeBot): string {
  const [grupo] = Object.entries(GRUPOS_DE_PERFIS).find(([, perfis]) =>
    (perfis as readonly PerfilDeBot[]).includes(perfil),
  ) ?? [''];
  return grupo;
}

/** Quantos bots caíram em cada grupo, do maior para o menor (ex.: [2, 1, 1]). */
function formaDosGrupos(perfis: readonly PerfilDeBot[]): number[] {
  const contagem = new Map<string, number>();
  for (const perfil of perfis)
    contagem.set(grupoDe(perfil), (contagem.get(grupoDe(perfil)) ?? 0) + 1);
  return [...contagem.values()].sort((a, b) => b - a);
}

function sorteios(quantidade: number): PerfilDeBot[][] {
  return Array.from({ length: SORTEIOS }, (_, semente) =>
    sortearPerfis(quantidade, geradorComSemente(semente + 1)),
  );
}

const TOTAL_DE_GRUPOS = Object.keys(GRUPOS_DE_PERFIS).length;

describe('Perfis dos bots — sorteio por grupos', () => {
  it('cada perfil está em exatamente um dos três grupos', () => {
    const agrupados = Object.values(GRUPOS_DE_PERFIS).flat();
    expect(TOTAL_DE_GRUPOS).toBe(3);
    expect([...agrupados].sort()).toEqual([...PERFIS_DE_BOT].sort());
  });

  it.each([1, 2])('com %i bot(s), qualquer perfil pode sair', (quantidade) => {
    const saiu = new Set(sorteios(quantidade).flat());
    expect([...saiu].sort()).toEqual([...PERFIS_DE_BOT].sort());
  });

  it('com 2 bots, os dois às vezes caem no mesmo grupo e às vezes não', () => {
    const formas = new Set(sorteios(2).map((perfis) => formaDosGrupos(perfis).join('')));
    expect(formas).toEqual(new Set(['2', '11']));
  });

  it('com 3 bots, um de cada grupo, com chance média de o grupo do primeiro se repetir', () => {
    const resultados = sorteios(3);
    const repetiram = resultados.filter((perfis) => formaDosGrupos(perfis).join('') === '21');

    for (const perfis of resultados)
      expect(['111', '21']).toContain(formaDosGrupos(perfis).join(''));
    // O primeiro sorteado volta no lugar do terceiro: os dois primeiros nunca dividem grupo.
    for (const perfis of resultados)
      expect(grupoDe(perfis[0] as PerfilDeBot)).not.toBe(grupoDe(perfis[1] as PerfilDeBot));
    expect(repetiram.length / SORTEIOS).toBeGreaterThan(0.25);
    expect(repetiram.length / SORTEIOS).toBeLessThan(0.42);
  });

  it('com 4 bots, um de cada grupo e um repetido', () => {
    for (const perfis of sorteios(4)) expect(formaDosGrupos(perfis)).toEqual([2, 1, 1]);
  });

  it.each([5, 6])('com %i bots, um de cada grupo e no máximo 3 do mesmo grupo', (quantidade) => {
    const formas = new Set<string>();
    for (const perfis of sorteios(quantidade)) {
      const forma = formaDosGrupos(perfis);
      expect(forma).toHaveLength(TOTAL_DE_GRUPOS);
      expect(Math.max(...forma)).toBeLessThanOrEqual(MAXIMO_DO_MESMO_GRUPO);
      formas.add(forma.join(''));
    }
    // Há chance de repetir: nem sempre a divisão é a mais equilibrada.
    expect(formas.size).toBeGreaterThan(1);
  });

  it('dentro do grupo, dois bots ganham perfis diferentes', () => {
    for (const perfis of sorteios(6)) {
      const porGrupo = new Map<string, PerfilDeBot[]>();
      for (const perfil of perfis)
        porGrupo.set(grupoDe(perfil), [...(porGrupo.get(grupoDe(perfil)) ?? []), perfil]);
      for (const doGrupo of porGrupo.values()) {
        expect(new Set(doGrupo.slice(0, 2)).size).toBe(Math.min(2, doGrupo.length));
      }
    }
  });
});

describe('Perfis dos bots — na sala', () => {
  function participante(id: string, ehBot: boolean): Participante {
    return {
      id,
      apelido: id,
      ehBot,
      perfilDoBot: null,
      conectado: true,
      saindo: false,
      tokenSessao: ehBot ? null : `token-${id}`,
      dispositivoId: ehBot ? null : `disp-${id}`,
    };
  }

  it('o bot fica sem perfil no lobby e ganha um ao começar a partida, sorteado de novo ao reiniciar', () => {
    const dono = participante('dono', false);
    const sala = new Sala('SALA', dono, CONFIGURACAO_PADRAO);
    const bots = ['b1', 'b2', 'b3'].map((id) => participante(id, true));
    for (const bot of bots) sala.adicionarBot('dono', bot);

    expect(bots.map((bot) => bot.perfilDoBot)).toEqual([null, null, null]);

    sala.iniciarPartida('dono', geradorComSemente(1));
    const primeira = bots.map((bot) => bot.perfilDoBot);
    expect(primeira.every((perfil) => perfil !== null)).toBe(true);
    expect(dono.perfilDoBot).toBeNull();

    const depois = Array.from({ length: 20 }, (_, i) => {
      sala.reiniciar('dono', geradorComSemente(i + 2));
      return bots.map((bot) => bot.perfilDoBot).join();
    });
    expect(new Set(depois).size).toBeGreaterThan(1);
  });
});

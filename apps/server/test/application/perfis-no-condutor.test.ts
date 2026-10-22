import { describe, expect, it } from 'vitest';
import { PERFIS_DE_BOT, type PerfilDeBot } from '../../src/domain/bot/perfis';
import {
  EstrategiaDoBot,
  type EstrategiaDeJogo,
  type EstrategiasDosPerfis,
} from '../../src/domain/estrategia-bot';
import { ATRASO_BOT_MS, BOT_SEM_ERRO, PRAZO_MS, ator, montarCenario } from '../apoio';

/** Estratégias de verdade que anotam qual perfil decidiu por quem. */
function estrategiasQueAnotam() {
  const decisoes: { perfil: PerfilDeBot; jogadorId: string }[] = [];
  const estrategias = {} as Record<PerfilDeBot, EstrategiaDeJogo>;
  for (const perfil of PERFIS_DE_BOT) {
    const real = new EstrategiaDoBot(BOT_SEM_ERRO, perfil);
    estrategias[perfil] = {
      escolherPalpite: (visao, jogadorId, permitidos) => {
        decisoes.push({ perfil, jogadorId });
        return real.escolherPalpite(visao, jogadorId, permitidos);
      },
      escolherCarta: (visao, jogadorId) => {
        decisoes.push({ perfil, jogadorId });
        return real.escolherCarta(visao, jogadorId);
      },
    };
  }
  return { decisoes, estrategias: estrategias as EstrategiasDosPerfis };
}

describe('perfis no condutor', () => {
  it('deveFazerCadaBotJogarComOPerfilSorteadoNoComecoDaPartida', () => {
    const { decisoes, estrategias } = estrategiasQueAnotam();
    const c = montarCenario({}, () => 1, estrategias);
    const ana = c.criarSala();
    for (let i = 0; i < 3; i++) c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    for (let i = 0; i < 12; i++) {
      c.humanosJogam([ana]);
      c.relogio.avancar(ATRASO_BOT_MS);
    }

    const sala = c.repositorio.buscar(ana.codigoSala);
    const perfilDe = new Map(sala?.todos.map((p) => [p.id, p.perfilDoBot]));
    const dosBots = decisoes.filter(({ jogadorId }) => jogadorId !== ana.jogadorId);
    expect(dosBots.length).toBeGreaterThan(0);
    for (const { perfil, jogadorId } of dosBots) expect(perfil).toBe(perfilDe.get(jogadorId));
  });

  it('deveJogarPeloHumanoQueEstourouOPrazoComOPerfilEquilibrado', () => {
    const { decisoes, estrategias } = estrategiasQueAnotam();
    const c = montarCenario({}, () => 1, estrategias);
    const ana = c.criarSala();
    c.servico.adicionarBot(ator(ana));
    c.servico.iniciarPartida(ator(ana));
    for (let i = 0; i < 12 && c.partidaDe(ana)?.idDaVez !== ana.jogadorId; i++) {
      c.relogio.avancar(ATRASO_BOT_MS);
    }

    c.relogio.avancar(PRAZO_MS);

    const daAna = decisoes.filter(({ jogadorId }) => jogadorId === ana.jogadorId);
    expect(daAna.length).toBeGreaterThan(0);
    for (const { perfil } of daAna) expect(perfil).toBe('equilibrado');
  });
});

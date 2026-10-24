import { CONFIGURACAO_PADRAO, type Carta } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import type { PerfilDeBot } from '../../src/domain/bot/perfis';
import type { AutorDaDecisao, Decisao, RodadaDoDiario } from '../../src/domain/diario';
import { criarEstrategiasDosPerfis } from '../../src/domain/estrategia-bot';
import type { Partida } from '../../src/domain/partida';
import { Sala, type Participante } from '../../src/domain/sala';
import { BOT_SEM_ERRO, geradorComSemente } from '../apoio';

function participante(id: string, ehBot = false): Participante {
  return {
    id,
    apelido: `Apelido de ${id}`,
    ehBot,
    perfilDoBot: null,
    conectado: true,
    tokenSessao: ehBot ? null : `token-${id}`,
    dispositivoId: ehBot ? null : `disp-${id}`,
  };
}

// A rodada em que Ana deixa o prazo estourar e a rodada em que Bia sai no meio.
const RODADA_DO_PRAZO = 2;
const RODADA_DA_SAIDA = 3;
const MAXIMO_DE_ACOES = 5_000;

function exigirPartida(sala: Sala): Partida {
  const partida = sala.partida;
  if (!partida) throw new Error('sem partida');
  return partida;
}

/**
 * Ana e Bia (humanas) contra dois bots, mesa com `mortosVeemCartas`. Ana estoura o prazo na
 * rodada 2 (o servidor joga por ela) e Bia sai no meio da rodada 3 (um bot termina por ela).
 */
function jogarPartidaRoteirizada(semente: number) {
  const sala = new Sala('SALA', participante('ana'), {
    ...CONFIGURACAO_PADRAO,
    mortosVeemCartas: true,
  });
  sala.adicionarHumano(participante('bia'));
  sala.adicionarBot('ana', participante('bot1', true));
  sala.adicionarBot('ana', participante('bot2', true));
  sala.iniciarPartida('ana', geradorComSemente(semente));
  const perfis = new Map<string, PerfilDeBot | null>(
    ['bot1', 'bot2'].map((id) => [id, sala.participante(id)?.perfilDoBot ?? null]),
  );
  const estrategias = criarEstrategiasDosPerfis(BOT_SEM_ERRO);
  const rodadas: RodadaDoDiario[] = [];
  let biaSaiu = false;

  for (let acao = 0; acao < MAXIMO_DE_ACOES && sala.emPartida; acao++) {
    const partida = exigirPartida(sala);
    if (partida.faseAtual === 'fim_de_rodada') {
      sala.iniciarProximaRodada();
      continue;
    }
    const vez = partida.idDaVez as string;
    const rodada = partida.visaoPara(null).numeroRodada;
    if (vez === 'bia' && rodada === RODADA_DA_SAIDA && !biaSaiu) {
      sala.sair('bia');
      biaSaiu = true;
      continue;
    }
    const humanoAgindo =
      (vez === 'ana' && rodada !== RODADA_DO_PRAZO) || (vez === 'bia' && !biaSaiu);
    if (!humanoAgindo) sala.jogarAVez(vez, estrategias);
    else if (partida.faseAtual === 'palpites') {
      sala.palpitar(vez, partida.palpitesPermitidos(vez)[0] as number);
    } else sala.jogarCarta(vez, (partida.cartasNaMaoDe(vez)[0] as Carta).id);
    rodadas.push(...(sala.diario?.retirarRodadasConcluidas() ?? []).map((r) => r.rodada));
  }
  return { sala, rodadas, perfis };
}

function autorEsperado(
  jogadorId: string,
  rodada: number,
  perfis: ReadonlyMap<string, PerfilDeBot | null>,
): AutorDaDecisao {
  const perfil = perfis.get(jogadorId);
  if (perfil) return { tipo: 'bot', perfil };
  if (jogadorId === 'ana' && rodada === RODADA_DO_PRAZO) {
    return { tipo: 'prazo', perfil: 'equilibrado' };
  }
  if (jogadorId === 'bia' && rodada >= RODADA_DA_SAIDA) {
    return { tipo: 'saida', perfil: 'equilibrado' };
  }
  return { tipo: 'humano' };
}

interface DecisaoNoInstante {
  readonly jogadorId: string;
  readonly decisao: Decisao;
  /** A mão que cada um ainda tinha quando a decisão foi tomada. */
  readonly maos: Map<string, Carta[]>;
  readonly vazasFechadas: number;
}

function decisoesComAsMaos(rodada: RodadaDoDiario): DecisaoNoInstante[] {
  const restantes = new Map(rodada.jogadores.map((j) => [j.jogadorId, [...j.mao]]));
  const decisoes: DecisaoNoInstante[] = [];
  const copiar = () => new Map([...restantes].map(([id, mao]) => [id, [...mao]]));
  for (const palpite of rodada.palpites) {
    if (palpite.decisao) {
      const { jogadorId, decisao } = palpite;
      decisoes.push({ jogadorId, decisao, maos: copiar(), vazasFechadas: 0 });
    }
  }
  for (const [vazasFechadas, vaza] of rodada.vazas.entries()) {
    for (const jogada of vaza.jogadas) {
      if (jogada.decisao) {
        const { jogadorId, decisao } = jogada;
        decisoes.push({ jogadorId, decisao, maos: copiar(), vazasFechadas });
      }
      const mao = restantes.get(jogada.jogadorId) ?? [];
      restantes.set(
        jogada.jogadorId,
        mao.filter((carta) => carta.id !== jogada.carta.id),
      );
    }
  }
  return decisoes;
}

const SEMENTES = [1, 2, 3, 4, 5, 6, 7, 8];
const partidas = SEMENTES.map(jogarPartidaRoteirizada);

describe('Diário da partida', () => {
  it('grava uma rodada por rodada jogada, em ordem, até o fim da partida', () => {
    for (const { sala, rodadas } of partidas) {
      const partida = exigirPartida(sala);
      expect(partida.faseAtual).toBe('encerrada');
      expect(rodadas.map((r) => r.numero)).toEqual(rodadas.map((_, i) => i + 1));
      expect(rodadas.length).toBe(partida.visaoPara(null).numeroRodada);
    }
  });

  it('a rodada 1 é cega: palpites decididos, cartas à mesa sem decisão', () => {
    for (const { rodadas } of partidas) {
      const [primeira] = rodadas as [RodadaDoDiario];
      expect(primeira.cega).toBe(true);
      expect(primeira.palpites.every((p) => p.decisao?.visao.rodadaCega)).toBe(true);
      expect(primeira.vazas).toHaveLength(1);
      expect(primeira.vazas[0]?.jogadas.every((j) => j.decisao === null)).toBe(true);
    }
  });

  it('cada rodada fecha: as cartas jogadas são as mãos distribuídas e as vidas batem', () => {
    for (const { rodadas } of partidas) {
      for (const rodada of rodadas) {
        const distribuidas = rodada.jogadores.flatMap((j) => j.mao.map((c) => c.id)).sort();
        const jogadas = rodada.vazas.flatMap((v) => v.jogadas.map((j) => j.carta.id)).sort();
        expect(jogadas).toEqual(distribuidas);
        expect(rodada.vazas).toHaveLength(rodada.cartasPorJogador);
        expect(rodada.palpites.map((p) => p.jogadorId).sort()).toEqual(
          rodada.jogadores.map((j) => j.jogadorId).sort(),
        );
        for (const resultado of rodada.resultado) {
          const jogador = rodada.jogadores.find((j) => j.jogadorId === resultado.jogadorId);
          const ganhas = rodada.vazas.filter((v) => v.vencedorId === resultado.jogadorId);
          expect(resultado.vazasFeitas).toBe(ganhas.length);
          expect(resultado.vidasDepois).toBe((jogador?.vidasAntes ?? 0) - resultado.vidasPerdidas);
        }
      }
    }
  });

  it('a vaza anulada é gravada sem vencedor', () => {
    const vazas = partidas.flatMap(({ rodadas }) => rodadas.flatMap((r) => r.vazas));
    const anuladas = vazas.filter((vaza) => vaza.vencedorId === null);
    expect(anuladas.length).toBeGreaterThan(0);
    for (const vaza of anuladas) expect(vaza.jogadas.length).toBeGreaterThan(1);
  });

  it('cada decisão diz quem decidiu: humano, bot com o perfil, prazo estourado ou saída', () => {
    const tipos = new Set<string>();
    for (const { rodadas, perfis } of partidas) {
      for (const rodada of rodadas) {
        for (const { jogadorId, decisao } of decisoesComAsMaos(rodada)) {
          expect(decisao.autor).toEqual(autorEsperado(jogadorId, rodada.numero, perfis));
          tipos.add(decisao.autor.tipo);
        }
      }
    }
    expect([...tipos].sort()).toEqual(['bot', 'humano', 'prazo', 'saida']);
  });

  it('a visão gravada é a de quem decidiu, sem a mão de nenhum outro jogador', () => {
    let conferidas = 0;
    for (const { rodadas } of partidas) {
      for (const rodada of rodadas) {
        for (const { jogadorId, decisao, maos, vazasFechadas } of decisoesComAsMaos(rodada)) {
          const { visao } = decisao;
          expect(visao.jogadores.every((j) => j.maoRevelada === null)).toBe(true);
          if (rodada.cega) {
            expect(visao.minhaMao.every((carta) => 'oculta' in carta)).toBe(true);
            continue;
          }
          expect(visao.minhaMao.map((c) => c.id).sort()).toEqual(
            (maos.get(jogadorId) ?? []).map((c) => c.id).sort(),
          );
          // Os ids de carta valem por rodada: a última vaza da rodada anterior fica de fora.
          const texto = JSON.stringify({
            ...visao,
            ultimaVaza: vazasFechadas > 0 ? visao.ultimaVaza : null,
          });
          for (const [donoId, mao] of maos) {
            if (donoId === jogadorId) continue;
            for (const carta of mao) expect(texto).not.toContain(JSON.stringify(carta));
          }
          conferidas += 1;
        }
      }
    }
    expect(conferidas).toBeGreaterThan(100);
  });

  it('nenhum apelido entra no diário', () => {
    for (const { rodadas } of partidas) {
      expect(JSON.stringify(rodadas)).not.toContain('Apelido de');
    }
  });

  it('o desfecho dá a colocação de todos: vencedores em 1º, quem saiu atrás', () => {
    for (const { sala } of partidas) {
      const desfecho = sala.diario?.desfecho;
      expect(desfecho?.motivo).toBe('fim');
      const colocacoes = new Map(desfecho?.colocacoes.map((c) => [c.jogadorId, c.colocacao]));
      expect([...colocacoes.keys()].sort()).toEqual(['ana', 'bia', 'bot1', 'bot2']);
      for (const vencedor of desfecho?.vencedores ?? []) expect(colocacoes.get(vencedor)).toBe(1);
      expect(colocacoes.get('bia')).toBeGreaterThan(1);
    }
  });

  it('partida interrompida não dá colocação a ninguém', () => {
    const { sala } = partidas[0] as (typeof partidas)[number];
    const desfecho = sala.diario?.desfechoSemFim('interrompida');
    expect(desfecho?.vencedores).toEqual([]);
    expect(desfecho?.colocacoes.every((c) => c.colocacao === null)).toBe(true);
  });

  it('cenário de teste não tem diário', () => {
    const sala = new Sala('SALA', participante('ana'), CONFIGURACAO_PADRAO, {
      cenarioDeTeste: true,
    });
    sala.adicionarBot('ana', participante('bot1', true));
    sala.iniciarPartida('ana', geradorComSemente(1));
    expect(sala.diario).toBeNull();
  });
});

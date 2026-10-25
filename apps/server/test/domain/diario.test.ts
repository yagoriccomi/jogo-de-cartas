import { CONFIGURACAO_PADRAO, type Carta } from '@fodinha/shared';
import { describe, expect, it } from 'vitest';
import type { PerfilDeBot } from '../../src/domain/bot/perfis';
import type { AutorDaDecisao, RodadaDoDiario } from '../../src/domain/diario';
import { ErroDeRegra } from '../../src/domain/erros';
import { criarEstrategiasDosPerfis } from '../../src/domain/estrategia-bot';
import type { Partida } from '../../src/domain/partida';
import type { VisaoDaPartida } from '../../src/domain/projecao';
import { reconstruirPartida, type DecisaoReconstruida } from '../../src/domain/reconstrucao';
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
    contaId: null,
  };
}

// O roteiro: Ana estoura o prazo na rodada 2, Caio chega no meio da 2 (senta na 3), Bia sai no
// meio da 3, Caio cai na 4 e é votado para fora. O dono troca `mortosVeemCartas` no meio da 2 e da 4.
const RODADA_DO_PRAZO = 2;
const RODADA_DA_ENTRADA = 2;
const RODADA_DA_SAIDA = 3;
const RODADA_DA_VOTACAO = 4;
const TROCAS_DA_OPCAO = new Map([
  [2, { depoisDe: 1, valor: false }],
  [4, { depoisDe: 3, valor: true }],
]);
const MAXIMO_DE_ACOES = 5_000;

function exigirPartida(sala: Sala): Partida {
  const partida = sala.partida;
  if (!partida) throw new Error('sem partida');
  return partida;
}

/** O que o teste viu na hora de cada decisão, direto da partida (não do diário). */
interface DecisaoObservada {
  readonly jogadorId: string;
  readonly autor: AutorDaDecisao;
  readonly visao: VisaoDaPartida;
}

function votarParaFora(sala: Sala, ausenteId: string): void {
  sala.marcarConexao(ausenteId, false);
  sala.abrirVotacao(ausenteId, 0);
  for (const votacao of sala.votacoesAbertas()) {
    if (votacao.ausenteId !== ausenteId) continue;
    for (const { eleitorId } of votacao.votos) sala.votar(eleitorId, ausenteId, false);
  }
}

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
  const observadas: DecisaoObservada[] = [];
  const feitos = new Set<string>();
  let acoesNaRodada = 0;

  for (let acao = 0; acao < MAXIMO_DE_ACOES && sala.emPartida; acao++) {
    const partida = exigirPartida(sala);
    if (partida.faseAtual === 'fim_de_rodada') {
      sala.iniciarProximaRodada();
      acoesNaRodada = 0;
      continue;
    }
    const vez = partida.idDaVez as string;
    const rodada = partida.visaoPara(null).numeroRodada;
    const troca = TROCAS_DA_OPCAO.get(rodada);
    if (troca && troca.depoisDe === acoesNaRodada && !feitos.has(`opcao${rodada}`)) {
      sala.definirMortosVeemCartas('ana', troca.valor);
      feitos.add(`opcao${rodada}`);
    }
    if (rodada === RODADA_DA_ENTRADA && !feitos.has('entrada')) {
      sala.adicionarHumano(participante('caio'));
      feitos.add('entrada');
    }
    if (vez === 'bia' && rodada === RODADA_DA_SAIDA && !feitos.has('saida')) {
      sala.sair('bia');
      feitos.add('saida');
      continue;
    }
    if (rodada === RODADA_DA_VOTACAO && partida.estaJogando('caio') && !feitos.has('votacao')) {
      votarParaFora(sala, 'caio');
      feitos.add('votacao');
    }

    const perfil = perfis.get(vez) ?? null;
    const saindo = partida.saiAoFimDaRodada(vez);
    const prazo = vez === 'ana' && rodada === RODADA_DO_PRAZO;
    const humanoAgindo = !perfil && !saindo && !prazo;
    const autor: AutorDaDecisao = perfil
      ? { tipo: 'bot', perfil }
      : humanoAgindo
        ? { tipo: 'humano' }
        : { tipo: saindo ? 'saida' : 'prazo', perfil: 'equilibrado' };
    observadas.push({ jogadorId: vez, autor, visao: partida.visaoPara(vez) });

    if (!humanoAgindo) sala.jogarAVez(vez, estrategias);
    else if (partida.faseAtual === 'palpites') {
      sala.palpitar(vez, partida.palpitesPermitidos(vez)[0] as number);
    } else sala.jogarCarta(vez, (partida.cartasNaMaoDe(vez)[0] as Carta).id);
    acoesNaRodada += 1;
    rodadas.push(...(sala.diario?.retirarRodadasConcluidas() ?? []).map((r) => r.rodada));
  }
  const configuracao = sala.diario?.configuracao ?? CONFIGURACAO_PADRAO;
  return { sala, rodadas, perfis, observadas, configuracao };
}

const SEMENTES = [1, 2, 3, 4, 5, 6, 7, 8];
const partidas = SEMENTES.map(jogarPartidaRoteirizada);

function reconstruidas(partida: (typeof partidas)[number]): DecisaoReconstruida[][] {
  return reconstruirPartida(partida.configuracao, partida.rodadas).map((r) => [...r.decisoes]);
}

/** As mãos que cada um ainda tinha a cada decisão, na mesma ordem da reconstrução. */
function maosNasDecisoes(rodada: RodadaDoDiario) {
  const restantes = new Map(rodada.jogadores.map((j) => [j.jogadorId, [...j.mao]]));
  const copiar = () => new Map([...restantes].map(([id, mao]) => [id, [...mao]]));
  const instantes: { maos: Map<string, Carta[]>; vazasFechadas: number }[] = [];
  for (const palpite of rodada.palpites) {
    if (palpite.autor) instantes.push({ maos: copiar(), vazasFechadas: 0 });
  }
  for (const [vazasFechadas, vaza] of rodada.vazas.entries()) {
    for (const jogada of vaza.jogadas) {
      if (jogada.autor) instantes.push({ maos: copiar(), vazasFechadas });
      const mao = restantes.get(jogada.jogadorId) ?? [];
      restantes.set(
        jogada.jogadorId,
        mao.filter((carta) => carta.id !== jogada.carta.id),
      );
    }
  }
  return instantes;
}

describe('Diário da partida', () => {
  it('grava uma rodada por rodada jogada, em ordem, até o fim da partida', () => {
    for (const { sala, rodadas } of partidas) {
      const partida = exigirPartida(sala);
      expect(partida.faseAtual).toBe('encerrada');
      expect(rodadas.map((r) => r.numero)).toEqual(rodadas.map((_, i) => i + 1));
      expect(rodadas.length).toBe(partida.visaoPara(null).numeroRodada);
    }
  });

  it('o roteiro passa por tudo o que a reconstrução precisa cobrir', () => {
    const todas = partidas.flatMap(({ rodadas }) => rodadas);
    expect(todas.some((r) => r.cega)).toBe(true);
    expect(todas.some((r) => r.vazas.some((v) => v.vencedorId === null))).toBe(true);
    expect(todas.some((r) => r.jogadores.some((j) => j.eliminado))).toBe(true);
    expect(todas.some((r) => r.ocorrencias.some((o) => o.tipo === 'saida'))).toBe(true);
    expect(todas.some((r) => r.ocorrencias.some((o) => o.tipo === 'mortosVeemCartas'))).toBe(true);
    for (const { rodadas } of partidas) {
      expect(rodadas[0]?.jogadores.some((j) => j.jogadorId === 'caio')).toBe(false);
      expect(rodadas[RODADA_DA_ENTRADA]?.jogadores.some((j) => j.jogadorId === 'caio')).toBe(true);
    }
    const tipos = new Set(
      partidas.flatMap(({ observadas }) => observadas.map((o) => o.autor.tipo)),
    );
    expect([...tipos].sort()).toEqual(['bot', 'humano', 'prazo', 'saida']);
  });

  it('a rodada 1 é cega: palpites com autor, cartas à mesa sem decisão', () => {
    for (const { rodadas } of partidas) {
      const [primeira] = rodadas as [RodadaDoDiario];
      expect(primeira.cega).toBe(true);
      expect(primeira.palpites.every((p) => p.autor !== null)).toBe(true);
      expect(primeira.vazas).toHaveLength(1);
      expect(primeira.vazas[0]?.jogadas.every((j) => j.autor === null)).toBe(true);
    }
  });

  it('cada rodada fecha: as cartas jogadas são as mãos distribuídas e as vidas batem', () => {
    for (const { rodadas } of partidas) {
      for (const rodada of rodadas) {
        const sentados = rodada.jogadores.filter((j) => !j.eliminado);
        const distribuidas = sentados.flatMap((j) => j.mao.map((c) => c.id)).sort();
        const jogadas = rodada.vazas.flatMap((v) => v.jogadas.map((j) => j.carta.id)).sort();
        expect(jogadas).toEqual(distribuidas);
        expect(rodada.jogadores.filter((j) => j.eliminado).every((j) => j.mao.length === 0)).toBe(
          true,
        );
        expect(rodada.vazas).toHaveLength(rodada.cartasPorJogador);
        expect(rodada.palpites.map((p) => p.jogadorId).sort()).toEqual(
          sentados.map((j) => j.jogadorId).sort(),
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

  it('a visão reconstruída de cada decisão é idêntica à que a partida dava na hora', () => {
    for (const partida of partidas) {
      const refeitas = reconstruidas(partida)
        .flat()
        .map(({ jogadorId, autor, visao }) => ({ jogadorId, autor, visao }));
      expect(refeitas).toHaveLength(partida.observadas.length);
      expect(refeitas).toEqual(partida.observadas);
    }
  });

  it('a visão reconstruída é a de quem decidiu, sem a mão de nenhum outro jogador', () => {
    let conferidas = 0;
    for (const partida of partidas) {
      const porRodada = reconstruidas(partida);
      partida.rodadas.forEach((rodada, indice) => {
        const instantes = maosNasDecisoes(rodada);
        (porRodada[indice] ?? []).forEach(({ jogadorId, visao }, posicao) => {
          const { maos, vazasFechadas } = instantes[posicao] ?? {
            maos: new Map(),
            vazasFechadas: 0,
          };
          expect(visao.jogadores.every((j) => j.maoRevelada === null)).toBe(true);
          if (rodada.cega) {
            expect(visao.minhaMao.every((carta) => 'oculta' in carta)).toBe(true);
            return;
          }
          expect(visao.minhaMao.map((c) => c.id).sort()).toEqual(
            (maos.get(jogadorId) ?? []).map((c: Carta) => c.id).sort(),
          );
          // Os ids de carta valem por rodada: a última vaza da rodada anterior fica de fora.
          const texto = JSON.stringify({
            ...visao,
            ultimaVaza: vazasFechadas > 0 ? visao.ultimaVaza : null,
          });
          for (const [donoId, mao] of maos) {
            if (donoId === jogadorId) continue;
            for (const carta of mao as Carta[]) expect(texto).not.toContain(JSON.stringify(carta));
          }
          conferidas += 1;
        });
      });
    }
    expect(conferidas).toBeGreaterThan(100);
  });

  it('diário adulterado não reconstrói: a reencenação aplica as regras', () => {
    const { configuracao, rodadas } = partidas[0] as (typeof partidas)[number];
    const segunda = rodadas[1] as RodadaDoDiario;
    const [primeiro, segundo, ...resto] = segunda.palpites;
    const foraDaVez = { ...segunda, palpites: [segundo, primeiro, ...resto] };
    expect(() =>
      reconstruirPartida(configuracao, [rodadas[0] as RodadaDoDiario, foraDaVez as RodadaDoDiario]),
    ).toThrow(ErroDeRegra);
    expect(() => reconstruirPartida(configuracao, rodadas.slice(1))).toThrow(ErroDeRegra);
  });

  it('nenhum apelido nem dispositivoId entra no diário', () => {
    for (const { sala, rodadas } of partidas) {
      const gravado = JSON.stringify([rodadas, sala.diario?.participantesIniciais]);
      expect(gravado).not.toContain('Apelido de');
      expect(gravado).not.toContain('disp-');
    }
  });

  it('o desfecho dá a colocação de todos: vencedores em 1º, quem saiu atrás', () => {
    for (const { sala } of partidas) {
      const desfecho = sala.diario?.desfecho;
      expect(desfecho?.motivo).toBe('fim');
      const colocacoes = new Map(desfecho?.colocacoes.map((c) => [c.jogadorId, c.colocacao]));
      expect([...colocacoes.keys()].sort()).toEqual(['ana', 'bia', 'bot1', 'bot2', 'caio']);
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

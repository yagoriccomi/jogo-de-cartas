import type { Client } from '@libsql/client';
import { CONFIGURACAO_PADRAO, type EstadoPartidaVisivel } from '@fodinha/shared';
import { CondutorDePartidas } from '../../application/condutor-de-partidas';
import { HistoricoDePartidas } from '../../application/historico-de-partidas';
import type { Cancelamento, Relogio } from '../../application/portas';
import { ServicoDeSalas } from '../../application/servico-de-salas';
import { criarEstrategiasDosPerfis } from '../../domain/estrategia-bot';
import { IdentificadoresCriptograficos, RepositorioDeSalasEmMemoria } from '../adaptadores';
import { RegistroDePartidasLibsql } from './registro-libsql';

/**
 * Só para desenvolvimento e testes de tela: uma conta de demonstração, uma sessão de login com o
 * token informado e uma partida inteira dessa conta contra dois bots, gravada no banco local. Sem
 * Google: a sessão é escrita direto nas tabelas do Better Auth.
 */

export const CONTA_DE_DEMONSTRACAO = {
  id: 'conta-demonstracao',
  nome: 'Demo do Replay',
  email: 'replay@fodinha.test',
} as const;

const ID_DA_SESSAO = 'sessao-demonstracao';
const VALIDADE_DA_SESSAO_MS = 365 * 24 * 60 * 60_000;
const BOTS_NA_PARTIDA = 2;
// A partida dura dezenas de rodadas; o teto só impede um laço eterno se algo travar.
const PASSOS_MAXIMOS = 100_000;
const silencioso = { info: () => {}, warn: () => {}, error: () => {} };

interface Agendado {
  readonly quando: number;
  readonly ordem: number;
  readonly acao: () => void;
}

/** Relógio que só anda quando pedem: a partida inteira roda em milissegundos de verdade. */
class RelogioDeMentira implements Relogio {
  private instante: number;
  private ordem = 0;
  private agendados: Agendado[] = [];

  constructor(inicio: number) {
    this.instante = inicio;
  }

  agora(): number {
    return this.instante;
  }

  agendar(atrasoMs: number, acao: () => void): Cancelamento {
    const agendado = { quando: this.instante + atrasoMs, ordem: this.ordem++, acao };
    this.agendados.push(agendado);
    return () => {
      this.agendados = this.agendados.filter((outro) => outro !== agendado);
    };
  }

  /** Dispara o próximo agendamento; `false` quando não há mais nada. */
  passo(): boolean {
    const proximo = [...this.agendados].sort((a, b) => a.quando - b.quando || a.ordem - b.ordem)[0];
    if (!proximo) return false;
    this.agendados = this.agendados.filter((outro) => outro !== proximo);
    this.instante = proximo.quando;
    proximo.acao();
    return true;
  }
}

async function gravarContaESessao(cliente: Client, token: string, agora: number): Promise<void> {
  const criadaEm = new Date(agora).toISOString();
  const expiraEm = new Date(agora + VALIDADE_DA_SESSAO_MS).toISOString();
  await cliente.batch(
    [
      {
        sql: `INSERT OR IGNORE INTO "user" (id, name, email, emailVerified, createdAt, updatedAt)
              VALUES (?, ?, ?, 1, ?, ?)`,
        args: [
          CONTA_DE_DEMONSTRACAO.id,
          CONTA_DE_DEMONSTRACAO.nome,
          CONTA_DE_DEMONSTRACAO.email,
          criadaEm,
          criadaEm,
        ],
      },
      {
        sql: `INSERT OR REPLACE INTO "session" (id, expiresAt, token, createdAt, updatedAt, userId)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [ID_DA_SESSAO, expiraEm, token, criadaEm, criadaEm, CONTA_DE_DEMONSTRACAO.id],
      },
    ],
    'write',
  );
}

async function jaTemPartida(cliente: Client): Promise<boolean> {
  const resultado = await cliente.execute({
    sql: `SELECT 1 FROM participantes_da_partida eu JOIN partidas p ON p.id = eu.partida_id
          WHERE eu.conta_id = ? AND p.desfecho = 'fim' LIMIT 1`,
    args: [CONTA_DE_DEMONSTRACAO.id],
  });
  return resultado.rows.length > 0;
}

/** Joga com o servidor de verdade (sala, condutor, bots, histórico); o humano joga pelo prazo. */
async function jogarPartida(cliente: Client, inicio: number): Promise<void> {
  const relogio = new RelogioDeMentira(inicio);
  const ultimos = new Map<string, EstadoPartidaVisivel>();
  const identificadores = new IdentificadoresCriptograficos();
  const historico = new HistoricoDePartidas({
    registro: new RegistroDePartidasLibsql(cliente),
    identificadores,
    relogio,
    registrador: silencioso,
  });
  const condutor = new CondutorDePartidas({
    notificador: {
      enviarEstadoSala: () => {},
      enviarEstadoPartida: (id, estado) => void ultimos.set(id, estado),
      enviarReacao: () => {},
    },
    relogio,
    estrategias: criarEstrategiasDosPerfis(Math.random),
    registrador: silencioso,
    gerarAleatorio: Math.random,
    historico,
    tempos: {
      atrasoDoBotMs: 1_000,
      pausaFimDeRodadaMs: 1_000,
      pausaExtraRodadaCegaMs: 0,
      carenciaDeDesconexaoMs: 10_000,
    },
  });
  const servico = new ServicoDeSalas({
    repositorio: new RepositorioDeSalasEmMemoria(),
    condutor,
    identificadores,
    relogio,
    gerarAleatorio: Math.random,
    registrador: silencioso,
    tempoDeAbandonoMs: Number.MAX_SAFE_INTEGER,
  });
  const sessao = servico.criarSala({
    apelido: 'Demo',
    configuracao: { ...CONFIGURACAO_PADRAO, prazoDaVezSegundos: 10 },
    dispositivoId: 'dispositivo-demonstracao',
    contaId: CONTA_DE_DEMONSTRACAO.id,
  });
  const ator = { codigoSala: sessao.codigoSala, jogadorId: sessao.jogadorId };
  for (let bot = 0; bot < BOTS_NA_PARTIDA; bot++) servico.adicionarBot(ator);
  servico.iniciarPartida(ator);
  for (let passo = 0; passo < PASSOS_MAXIMOS; passo++) {
    if (ultimos.get(sessao.jogadorId)?.fase === 'encerrada') break;
    if (!relogio.passo()) break;
  }
  await historico.aguardarGravacoes();
  if (ultimos.get(sessao.jogadorId)?.fase !== 'encerrada') {
    throw new Error('A partida de demonstração não chegou ao fim.');
  }
}

/** Idempotente: rodar de novo só renova a sessão; a partida é gravada uma vez. */
export async function semearReplay(
  cliente: Client,
  token: string,
  agora: number,
): Promise<{ partidaNova: boolean }> {
  await gravarContaESessao(cliente, token, agora);
  if (await jaTemPartida(cliente)) return { partidaNova: false };
  await jogarPartida(cliente, agora);
  return { partidaNova: true };
}

import type { Client, Value } from '@libsql/client';
import type {
  AssentoGravado,
  ConsultaDoHistorico,
  LeituraDoHistorico,
  PartidaGravadaDaConta,
  PartidaParaRever,
} from '../../application/portas';
import type { MotivoDoFim, RodadaDoDiario } from '../../domain/diario';
import { ehRodadaDoDiario, lerJson } from './exportar-treino';

const MOTIVOS: readonly MotivoDoFim[] = ['fim', 'interrompida', 'abandonada'];
// Sem cursor, a página começa depois de qualquer instante possível.
const INICIO_DA_LISTA = Number.MAX_SAFE_INTEGER;

function numeroOuNulo(valor: Value | undefined): number | null {
  return valor === null || valor === undefined ? null : Number(valor);
}

function motivoDoFim(valor: Value | undefined): MotivoDoFim | null {
  return MOTIVOS.find((motivo) => motivo === valor) ?? null;
}

/** Turso em produção; `file:` em desenvolvimento e `file::memory:` nos testes. Só lê. */
export class LeituraDoHistoricoLibsql implements LeituraDoHistorico {
  readonly ligada = true;

  constructor(private readonly cliente: Client) {}

  async partidasDaConta({
    contaId,
    depoisDe,
    limite,
  }: ConsultaDoHistorico): Promise<PartidaGravadaDaConta[]> {
    const instante = depoisDe?.iniciadaEm ?? INICIO_DA_LISTA;
    const id = depoisDe?.idPartida ?? '';
    // Cursor por (início, id): estável mesmo com partidas novas chegando entre uma página e outra.
    const resultado = await this.cliente.execute({
      sql: `SELECT p.id, p.iniciada_em, p.encerrada_em, p.rodadas_gravadas,
                   (SELECT COUNT(*) FROM participantes_da_partida t WHERE t.partida_id = p.id)
                     AS jogadores,
                   MIN(eu.colocacao) AS colocacao
            FROM participantes_da_partida eu JOIN partidas p ON p.id = eu.partida_id
            WHERE eu.conta_id = ? AND p.desfecho = 'fim'
              AND (p.iniciada_em < ? OR (p.iniciada_em = ? AND p.id < ?))
            GROUP BY p.id
            ORDER BY p.iniciada_em DESC, p.id DESC
            LIMIT ?`,
      args: [contaId, instante, instante, id, limite],
    });
    return resultado.rows.map((linha) => ({
      idPartida: String(linha.id),
      iniciadaEm: Number(linha.iniciada_em),
      encerradaEm: Number(linha.encerrada_em),
      jogadores: Number(linha.jogadores),
      rodadas: Number(linha.rodadas_gravadas),
      colocacao: numeroOuNulo(linha.colocacao),
    }));
  }

  async partidaParaRever(contaId: string, idPartida: string): Promise<PartidaParaRever | null> {
    const [partidas, assentos] = await this.cliente.batch(
      [
        {
          sql: 'SELECT configuracao, desfecho, rodadas_gravadas FROM partidas WHERE id = ?',
          args: [idPartida],
        },
        {
          // rowid: a ordem em que os assentos foram gravados (os que entraram no meio, depois).
          sql: `SELECT jogador_id, tipo, conta_id FROM participantes_da_partida
                WHERE partida_id = ? ORDER BY rowid`,
          args: [idPartida],
        },
      ],
      'read',
    );
    const partida = partidas?.rows[0];
    const linhas = assentos?.rows ?? [];
    const daConta = linhas.find((linha) => linha.conta_id === contaId);
    if (!partida || !daConta) return null;
    return {
      configuracao: lerJson(partida.configuracao),
      motivoDoFim: motivoDoFim(partida.desfecho),
      totalDeRodadas: Number(partida.rodadas_gravadas),
      jogadorIdDaConta: String(daConta.jogador_id),
      assentos: linhas.map((linha): AssentoGravado => ({
        jogadorId: String(linha.jogador_id),
        tipo: linha.tipo === 'bot' ? 'bot' : 'humano',
      })),
    };
  }

  async rodadasAte(idPartida: string, ate: number): Promise<RodadaDoDiario[]> {
    const resultado = await this.cliente.execute({
      sql: 'SELECT dados FROM rodadas WHERE partida_id = ? AND numero <= ? ORDER BY numero',
      args: [idPartida, ate],
    });
    return resultado.rows.map((linha) => lerJson(linha.dados)).filter(ehRodadaDoDiario);
  }
}

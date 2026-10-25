import type { Client, InStatement } from '@libsql/client';
import type {
  FimDaPartida,
  InicioDaPartida,
  RegistroDePartidas,
  RodadaParaGravar,
} from '../../application/portas';
import { VERSAO_DO_DIARIO, type ParticipanteDoDiario } from '../../domain/diario';

function inserirParticipante(idPartida: string, participante: ParticipanteDoDiario): InStatement {
  return {
    // Ignora o repetido: quem já estava na partida não é sobrescrito por uma gravação atrasada.
    sql: `INSERT OR IGNORE INTO participantes_da_partida
            (partida_id, jogador_id, tipo, perfil, conta_id)
          VALUES (?, ?, ?, ?, ?)`,
    args: [
      idPartida,
      participante.jogadorId,
      participante.tipo,
      participante.perfil,
      participante.contaId,
    ],
  };
}

/** Turso em produção; `file:` em desenvolvimento e `file::memory:` nos testes de integração. */
export class RegistroDePartidasLibsql implements RegistroDePartidas {
  constructor(private readonly cliente: Client) {}

  async iniciarPartida({
    idPartida,
    em,
    configuracao,
    participantes,
  }: InicioDaPartida): Promise<void> {
    await this.cliente.batch(
      [
        {
          sql: `INSERT INTO partidas (id, iniciada_em, configuracao, versao_do_diario)
                VALUES (?, ?, ?, ?)`,
          args: [idPartida, em, JSON.stringify(configuracao), VERSAO_DO_DIARIO],
        },
        ...participantes.map((participante) => inserirParticipante(idPartida, participante)),
      ],
      'write',
    );
  }

  async gravarRodada({
    idPartida,
    em,
    rodada,
    participantesNovos,
  }: RodadaParaGravar): Promise<void> {
    await this.cliente.batch(
      [
        ...participantesNovos.map((participante) => inserirParticipante(idPartida, participante)),
        {
          sql: 'INSERT INTO rodadas (partida_id, numero, gravada_em, dados) VALUES (?, ?, ?, ?)',
          args: [idPartida, rodada.numero, em, JSON.stringify(rodada)],
        },
        {
          sql: 'UPDATE partidas SET rodadas_gravadas = rodadas_gravadas + 1 WHERE id = ?',
          args: [idPartida],
        },
      ],
      'write',
    );
  }

  async encerrarPartida({ idPartida, em, desfecho }: FimDaPartida): Promise<void> {
    await this.cliente.batch(
      [
        {
          sql: 'UPDATE partidas SET encerrada_em = ?, desfecho = ? WHERE id = ?',
          args: [em, desfecho.motivo, idPartida],
        },
        ...desfecho.colocacoes.map(({ jogadorId, colocacao, vidasFinais }) => ({
          sql: `UPDATE participantes_da_partida SET colocacao = ?, vidas_finais = ?
                WHERE partida_id = ? AND jogador_id = ?`,
          args: [colocacao, vidasFinais, idPartida, jogadorId],
        })),
      ],
      'write',
    );
  }
}

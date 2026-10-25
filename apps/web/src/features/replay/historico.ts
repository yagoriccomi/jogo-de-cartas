import {
  caminhoDaRodadaDoReplay,
  PARAMETROS_DO_HISTORICO,
  ROTAS_DO_HISTORICO,
  type ErroDoHistorico,
  type MotivoDoErroDoHistorico,
  type PaginaDoHistorico,
  type RodadaDoReplay,
} from '@fodinha/shared';
import { descreverErro, registrar } from '../../lib/log';
import { URL_SERVIDOR } from '../../lib/socket';
import { cabecalhos } from '../login/login';

/** Resposta do histórico já tratada: a tela só escolhe o que mostrar. */
export type RespostaDoHistorico<T> =
  | { readonly ok: true; readonly dados: T }
  | { readonly ok: false; readonly motivo: MotivoDoErroDoHistorico; readonly mensagem: string };

const SEM_REDE = 'Não deu para falar com o servidor. Confira a conexão e tente de novo.';

function ehErroDoHistorico(corpo: unknown): corpo is ErroDoHistorico {
  return (
    typeof corpo === 'object' &&
    corpo !== null &&
    typeof (corpo as Record<string, unknown>).motivo === 'string' &&
    typeof (corpo as Record<string, unknown>).erro === 'string'
  );
}

/** Ponto único das chamadas: loga o detalhe técnico e devolve só a mensagem limpa. */
async function consultar<T>(caminho: string, operacao: string): Promise<RespostaDoHistorico<T>> {
  try {
    const resposta = await fetch(`${URL_SERVIDOR}${caminho}`, { headers: cabecalhos() });
    const corpo: unknown = await resposta.json();
    if (resposta.ok) return { ok: true, dados: corpo as T };
    if (!ehErroDoHistorico(corpo)) throw new Error(`HTTP ${resposta.status} sem corpo de erro`);
    // Sem login e histórico desligado são situações normais: a tela some, sem alarde no log.
    if (corpo.motivo !== 'sem_login' && corpo.motivo !== 'desligado') {
      registrar('warn', 'historico.recusado', { operacao, motivo: corpo.motivo });
    }
    return { ok: false, motivo: corpo.motivo, mensagem: corpo.erro };
  } catch (erro) {
    registrar('warn', 'historico.falhou', { operacao, ...descreverErro(erro) });
    return { ok: false, motivo: 'indisponivel', mensagem: SEM_REDE };
  }
}

export function buscarMinhasPartidas(
  cursor: string | null,
): Promise<RespostaDoHistorico<PaginaDoHistorico>> {
  const consulta =
    cursor === null ? '' : `?${PARAMETROS_DO_HISTORICO.cursor}=${encodeURIComponent(cursor)}`;
  return consultar(`${ROTAS_DO_HISTORICO.partidas}${consulta}`, 'historico.partidas');
}

export function buscarRodadaDoReplay(
  idPartida: string,
  numero: number,
): Promise<RespostaDoHistorico<RodadaDoReplay>> {
  return consultar(caminhoDaRodadaDoReplay(idPartida, numero), 'historico.rodada');
}

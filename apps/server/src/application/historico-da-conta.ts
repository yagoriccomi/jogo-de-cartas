import type {
  EstadoPartidaVisivel,
  MotivoDoErroDoHistorico,
  PartidaNoHistorico,
} from '@fodinha/shared';
import { validarConfiguracao } from '../domain/configuracao';
import { ErroDeRegra } from '../domain/erros';
import { exigirPartidaTerminada, lancesDaRodada, type AssentoNoReplay } from '../domain/replay';
import type {
  AssentoGravado,
  ContaDeLogin,
  CursorDoHistorico,
  LeituraDoHistorico,
  Registrador,
} from './portas';

export type Resultado<T> =
  | { readonly ok: true; readonly dados: T }
  | { readonly ok: false; readonly motivo: MotivoDoErroDoHistorico };

export interface PaginaDaConta {
  readonly partidas: readonly PartidaNoHistorico[];
  /** `null` = acabou. */
  readonly proximo: CursorDoHistorico | null;
}

export interface ReplayDaConta {
  readonly totalDeRodadas: number;
  readonly jogadorId: string;
  readonly lances: readonly EstadoPartidaVisivel[];
}

export interface PedidoDaPagina {
  readonly conta: ContaDeLogin;
  readonly depoisDe: CursorDoHistorico | null;
  readonly limite: number;
}

export interface PedidoDaRodada {
  readonly conta: ContaDeLogin;
  readonly idPartida: string;
  readonly numero: number;
}

const falha = (motivo: MotivoDoErroDoHistorico) => ({ ok: false as const, motivo });

/** O primeiro nome da conta: é ela mesma revendo, e o nome inteiro espremeria a placa. */
function primeiroNome(conta: ContaDeLogin): string {
  return conta.nome.trim().split(/\s+/)[0] || 'Você';
}

/**
 * Como cada assento aparece no replay. O histórico não guarda apelido (P4): quem revê vê o próprio
 * nome; os outros, só se eram gente ou bot, numerados na ordem em que entraram.
 */
export function assentosDoReplay(
  assentos: readonly AssentoGravado[],
  jogadorIdDaConta: string,
  nomeDaConta: string,
): Map<string, AssentoNoReplay> {
  let humanos = 0;
  let bots = 0;
  return new Map(
    assentos.map(({ jogadorId, tipo }): [string, AssentoNoReplay] => {
      if (jogadorId === jogadorIdDaConta)
        return [jogadorId, { apelido: nomeDaConta, ehBot: false }];
      if (tipo === 'bot') return [jogadorId, { apelido: `Bot ${++bots}`, ehBot: true }];
      return [jogadorId, { apelido: `Jogador ${++humanos}`, ehBot: false }];
    }),
  );
}

/**
 * "Minhas partidas" e o replay, sempre do ponto de vista de uma conta logada. Quem não jogou a
 * partida recebe o mesmo `nao_encontrada` de uma partida que não existe.
 */
export class HistoricoDaConta {
  constructor(
    private readonly leitura: LeituraDoHistorico,
    private readonly registrador: Registrador,
  ) {}

  get ligado(): boolean {
    return this.leitura.ligada;
  }

  async pagina({ conta, depoisDe, limite }: PedidoDaPagina): Promise<Resultado<PaginaDaConta>> {
    if (!this.leitura.ligada) return falha('desligado');
    // Um a mais que o pedido: diz se existe próxima página sem contar a tabela inteira.
    const lidas = await this.leitura.partidasDaConta({
      contaId: conta.id,
      depoisDe,
      limite: limite + 1,
    });
    const partidas = lidas.slice(0, limite).map((lida) => ({
      id: lida.idPartida,
      iniciadaEm: lida.iniciadaEm,
      encerradaEm: lida.encerradaEm,
      jogadores: lida.jogadores,
      rodadas: lida.rodadas,
      colocacao: lida.colocacao,
      venceu: lida.colocacao === 1,
    }));
    const ultima = partidas[partidas.length - 1];
    const proximo =
      lidas.length > limite && ultima
        ? { iniciadaEm: ultima.iniciadaEm, idPartida: ultima.id }
        : null;
    return { ok: true, dados: { partidas, proximo } };
  }

  async rodada({ conta, idPartida, numero }: PedidoDaRodada): Promise<Resultado<ReplayDaConta>> {
    if (!this.leitura.ligada) return falha('desligado');
    const partida = await this.leitura.partidaParaRever(conta.id, idPartida);
    if (!partida) return falha('nao_encontrada');
    try {
      exigirPartidaTerminada(partida.motivoDoFim);
    } catch {
      return falha('inacabada');
    }
    if (numero < 1 || numero > partida.totalDeRodadas) return falha('invalido');
    try {
      const lances = lancesDaRodada({
        configuracao: validarConfiguracao(partida.configuracao),
        motivoDoFim: partida.motivoDoFim,
        rodadas: await this.leitura.rodadasAte(idPartida, numero),
        observadorId: partida.jogadorIdDaConta,
        assentos: assentosDoReplay(partida.assentos, partida.jogadorIdDaConta, primeiroNome(conta)),
      });
      return {
        ok: true,
        dados: {
          totalDeRodadas: partida.totalDeRodadas,
          jogadorId: partida.jogadorIdDaConta,
          lances,
        },
      };
    } catch (erro) {
      if (!(erro instanceof ErroDeRegra)) throw erro;
      this.registrador.warn({ partida: idPartida, rodada: numero, erro }, 'Replay ilegível');
      return falha('ilegivel');
    }
  }
}

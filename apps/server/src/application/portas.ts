import type { EstadoPartidaVisivel, EstadoSala, ReacaoNaMesa } from '@fodinha/shared';
import type { Sala } from '../domain/sala';

/** Contratos que a aplicação exige da infraestrutura (inversão de dependência). */

export interface RepositorioDeSalas {
  buscar(codigo: string): Sala | undefined;
  salvar(sala: Sala): void;
  remover(codigo: string): void;
  existe(codigo: string): boolean;
}

export interface Notificador {
  enviarEstadoSala(destinatarioIds: readonly string[], estado: EstadoSala): void;
  enviarEstadoPartida(destinatarioId: string, estado: EstadoPartidaVisivel): void;
  enviarReacao(destinatarioIds: readonly string[], reacao: ReacaoNaMesa): void;
}

export type Cancelamento = () => void;

export interface Relogio {
  agora(): number;
  agendar(atrasoMs: number, acao: () => void): Cancelamento;
}

export interface GeradorDeIdentificadores {
  novoId(): string;
  novoToken(): string;
  novoCodigoSala(): string;
}

export interface Registrador {
  info(dados: object, mensagem: string): void;
  warn(dados: object, mensagem: string): void;
  error(dados: object, mensagem: string): void;
}

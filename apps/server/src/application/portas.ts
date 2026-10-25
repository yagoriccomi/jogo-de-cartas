import type {
  ConfiguracaoPartida,
  EstadoPartidaVisivel,
  EstadoSala,
  ReacaoNaMesa,
} from '@fodinha/shared';
import type { DesfechoDoDiario, ParticipanteDoDiario, RodadaDoDiario } from '../domain/diario';
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

export interface InicioDaPartida {
  readonly idPartida: string;
  readonly em: number;
  readonly configuracao: ConfiguracaoPartida;
  readonly participantes: readonly ParticipanteDoDiario[];
}

export interface RodadaParaGravar {
  readonly idPartida: string;
  readonly em: number;
  readonly rodada: RodadaDoDiario;
  readonly participantesNovos: readonly ParticipanteDoDiario[];
}

export interface FimDaPartida {
  readonly idPartida: string;
  readonly em: number;
  readonly desfecho: DesfechoDoDiario;
}

/**
 * Histórico das partidas (Turso em produção). Uma gravação por rodada, não por carta: menos
 * escritas no banco, e uma queda do servidor perde no máximo a rodada em curso.
 */
export interface RegistroDePartidas {
  iniciarPartida(inicio: InicioDaPartida): Promise<void>;
  gravarRodada(rodada: RodadaParaGravar): Promise<void>;
  encerrarPartida(fim: FimDaPartida): Promise<void>;
}

/** Conta Google de quem está logado. Só o `id` chega ao histórico (P4); nome e e-mail, à tela. */
export interface ContaDeLogin {
  readonly id: string;
  readonly nome: string;
  readonly email: string;
}

/** O que o web recebe ao trocar o código de uso único da volta do Google. */
export interface SessaoDeLogin {
  /** Vai no cabeçalho `Authorization` e no aperto de mão do socket. */
  readonly token: string;
  readonly conta: ContaDeLogin;
}

/**
 * Login opcional (Better Auth + Google). Desligado (`ligado: false`) sem as variáveis do Google ou
 * sem banco: todos jogam como convidado, que é sempre o padrão.
 */
export interface Login {
  readonly ligado: boolean;
  /** `null` quando o token não vale: expirado, encerrado, forjado ou com o login desligado. */
  contaDoToken(token: string): Promise<ContaDeLogin | null>;
  /** Consome o código de uso único; `null` se ele não existe, já foi usado ou expirou. */
  trocarCodigo(codigo: string): Promise<SessaoDeLogin | null>;
  /** Encerra a sessão no servidor: o token deixa de valer em qualquer aba. */
  encerrar(token: string): Promise<void>;
}

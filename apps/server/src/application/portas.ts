import type {
  ConfiguracaoPartida,
  EstadoPartidaVisivel,
  EstadoSala,
  ReacaoNaMesa,
} from '@fodinha/shared';
import type {
  DesfechoDoDiario,
  MotivoDoFim,
  ParticipanteDoDiario,
  RodadaDoDiario,
} from '../domain/diario';
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

/** Onde a listagem continua: a partida mais antiga da página anterior. */
export interface CursorDoHistorico {
  readonly iniciadaEm: number;
  readonly idPartida: string;
}

export interface ConsultaDoHistorico {
  readonly contaId: string;
  /** `null` = a primeira página. */
  readonly depoisDe: CursorDoHistorico | null;
  readonly limite: number;
}

export interface PartidaGravadaDaConta {
  readonly idPartida: string;
  readonly iniciadaEm: number;
  readonly encerradaEm: number;
  readonly jogadores: number;
  readonly rodadas: number;
  /** A melhor colocação dos assentos da conta; `null` se não foi gravada. */
  readonly colocacao: number | null;
}

/** Um assento da partida, sem conta: quem revê só precisa saber se era bot. */
export interface AssentoGravado {
  readonly jogadorId: string;
  readonly tipo: 'humano' | 'bot';
}

export interface PartidaParaRever {
  /** `unknown`: o JSON do banco é validado no domínio, como qualquer entrada. */
  readonly configuracao: unknown;
  readonly motivoDoFim: MotivoDoFim | null;
  readonly totalDeRodadas: number;
  /** O assento da conta que pede (o primeiro, se ela abriu mais de um). */
  readonly jogadorIdDaConta: string;
  /** Na ordem em que entraram na partida. */
  readonly assentos: readonly AssentoGravado[];
}

/**
 * Leitura do histórico para "Minhas partidas" e o replay. Só enxerga partidas em que a conta
 * jogou: a checagem de quem participou mora na consulta, não na tela.
 */
export interface LeituraDoHistorico {
  /** `false` sem banco: as rotas avisam o web, que esconde o histórico. */
  readonly ligada: boolean;
  /** Só as terminadas pelas regras (as únicas com replay), da mais recente para trás. */
  partidasDaConta(consulta: ConsultaDoHistorico): Promise<PartidaGravadaDaConta[]>;
  /** `null` = a partida não existe ou a conta não jogou nela. */
  partidaParaRever(contaId: string, idPartida: string): Promise<PartidaParaRever | null>;
  /** As rodadas de 1 até `ate`, em ordem; as que não passam na validação do formato ficam de fora. */
  rodadasAte(idPartida: string, ate: number): Promise<RodadaDoDiario[]>;
}

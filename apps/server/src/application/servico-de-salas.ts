import type { SessaoJogador } from '@fodinha/shared';
import type { GeradorAleatorio } from '../domain/aleatoriedade';
import { ErroDeRegra } from '../domain/erros';
import { Sala, type Participante } from '../domain/sala';
import { normalizarApelido, normalizarCodigoSala } from './apelido';
import type { CondutorDePartidas } from './condutor-de-partidas';
import type {
  Cancelamento,
  GeradorDeIdentificadores,
  RepositorioDeSalas,
  Registrador,
  Relogio,
} from './portas';

const APELIDOS_DE_BOT = ['Zé', 'Dona Cida', 'Tião', 'Lurdinha', 'Juca', 'Neide', 'Bastião', 'Fia'];

/** Quem está agindo: extraído da sessão do socket, nunca do payload do cliente. */
export interface Ator {
  readonly codigoSala: string;
  readonly jogadorId: string;
}

export interface DependenciasDoServico {
  readonly repositorio: RepositorioDeSalas;
  readonly condutor: CondutorDePartidas;
  readonly identificadores: GeradorDeIdentificadores;
  readonly relogio: Relogio;
  readonly gerarAleatorio: GeradorAleatorio;
  readonly registrador: Registrador;
  /** Por quanto tempo uma sala sem nenhum humano conectado é mantida à espera de reconexão. */
  readonly tempoDeAbandonoMs: number;
}

/** Casos de uso de sala e partida. Cada método termina publicando o novo estado. */
export class ServicoDeSalas {
  private readonly limpezasAgendadas = new Map<string, Cancelamento>();

  constructor(private readonly deps: DependenciasDoServico) {}

  criarSala(dados: { apelido?: unknown; configuracao?: unknown }): SessaoJogador {
    const anfitriao = this.novoHumano(normalizarApelido(dados.apelido));
    const sala = new Sala(this.codigoLivre(), anfitriao, dados.configuracao);
    this.deps.repositorio.salvar(sala);
    this.deps.registrador.info({ sala: sala.codigo }, 'Sala criada');
    this.deps.condutor.aposMudanca(sala);
    return this.sessao(sala, anfitriao);
  }

  entrarSala(dados: { codigoSala?: unknown; apelido?: unknown }): SessaoJogador {
    const sala = this.salaExistente(normalizarCodigoSala(dados.codigoSala));
    const participante = this.novoHumano(normalizarApelido(dados.apelido));
    sala.adicionarHumano(participante);
    this.deps.condutor.aposMudanca(sala);
    return this.sessao(sala, participante);
  }

  reconectar(dados: { codigoSala?: unknown; tokenSessao?: unknown }): SessaoJogador {
    const sala = this.salaExistente(normalizarCodigoSala(dados.codigoSala));
    const participante =
      typeof dados.tokenSessao === 'string'
        ? sala.participantePorToken(dados.tokenSessao)
        : undefined;
    if (!participante || participante.assumidoPorBot) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Sessão expirada. Entre na sala novamente.');
    }
    sala.marcarConexao(participante.id, true);
    this.cancelarLimpeza(sala.codigo);
    this.deps.condutor.aposMudanca(sala);
    return this.sessao(sala, participante);
  }

  /** Reenvia o estado atual a todos da sala (ex.: um socket acabou de se vincular). */
  republicar(codigoSala: string): void {
    const sala = this.deps.repositorio.buscar(codigoSala);
    if (sala) this.deps.condutor.publicar(sala);
  }

  desconectar(ator: Ator): void {
    const sala = this.deps.repositorio.buscar(ator.codigoSala);
    if (!sala?.participante(ator.jogadorId)) return;
    sala.marcarConexao(ator.jogadorId, false);
    if (sala.humanosConectados === 0) this.agendarLimpeza(sala);
    this.deps.condutor.aposMudanca(sala);
  }

  configurar(ator: Ator, configuracao: unknown): void {
    this.alterar(ator, (sala) => sala.configurar(ator.jogadorId, configuracao));
  }

  adicionarBot(ator: Ator): void {
    this.alterar(ator, (sala) => sala.adicionarBot(ator.jogadorId, this.novoBot(sala)));
  }

  removerParticipante(ator: Ator, participanteId: unknown): void {
    if (typeof participanteId !== 'string') {
      throw new ErroDeRegra('ENTRADA_INVALIDA', 'Participante inválido.');
    }
    this.alterar(ator, (sala) => sala.removerParticipante(ator.jogadorId, participanteId));
  }

  iniciarPartida(ator: Ator): void {
    this.alterar(ator, (sala) => {
      sala.iniciarPartida(ator.jogadorId, this.deps.gerarAleatorio);
      this.deps.registrador.info(
        { sala: sala.codigo, participantes: sala.todos.length },
        'Partida iniciada',
      );
    });
  }

  sair(ator: Ator): void {
    const sala = this.salaExistente(ator.codigoSala);
    sala.sair(ator.jogadorId);
    if (sala.humanosPresentes === 0) {
      this.removerSala(sala.codigo);
      return;
    }
    this.deps.condutor.aposMudanca(sala);
  }

  palpitar(ator: Ator, quantidade: unknown): void {
    if (typeof quantidade !== 'number') {
      throw new ErroDeRegra('PALPITE_INVALIDO', 'Palpite inválido.');
    }
    this.alterar(ator, (sala) => this.partidaDe(sala).palpitar(ator.jogadorId, quantidade));
  }

  jogarCarta(ator: Ator, cartaId: unknown): void {
    if (typeof cartaId !== 'string') {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Carta inválida.');
    }
    this.alterar(ator, (sala) => this.partidaDe(sala).jogarCarta(ator.jogadorId, cartaId));
  }

  private alterar(ator: Ator, mudanca: (sala: Sala) => void): void {
    const sala = this.salaExistente(ator.codigoSala);
    if (!sala.participante(ator.jogadorId)) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Você não está nesta sala.');
    }
    mudanca(sala);
    this.deps.condutor.aposMudanca(sala);
  }

  private partidaDe(sala: Sala) {
    if (!sala.emPartida || !sala.partida) {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Não há partida em andamento.');
    }
    return sala.partida;
  }

  private salaExistente(codigo: string): Sala {
    const sala = this.deps.repositorio.buscar(codigo);
    if (!sala) throw new ErroDeRegra('SALA_NAO_ENCONTRADA', 'Sala não encontrada.');
    return sala;
  }

  private agendarLimpeza(sala: Sala): void {
    this.cancelarLimpeza(sala.codigo);
    const cancelar = this.deps.relogio.agendar(this.deps.tempoDeAbandonoMs, () => {
      this.limpezasAgendadas.delete(sala.codigo);
      if (sala.humanosConectados === 0) this.removerSala(sala.codigo);
    });
    this.limpezasAgendadas.set(sala.codigo, cancelar);
  }

  private cancelarLimpeza(codigo: string): void {
    this.limpezasAgendadas.get(codigo)?.();
    this.limpezasAgendadas.delete(codigo);
  }

  private removerSala(codigo: string): void {
    this.cancelarLimpeza(codigo);
    this.deps.condutor.encerrar(codigo);
    this.deps.repositorio.remover(codigo);
    this.deps.registrador.info({ sala: codigo }, 'Sala removida');
  }

  private codigoLivre(): string {
    let codigo = this.deps.identificadores.novoCodigoSala();
    while (this.deps.repositorio.existe(codigo))
      codigo = this.deps.identificadores.novoCodigoSala();
    return codigo;
  }

  private novoHumano(apelido: string): Participante {
    return {
      id: this.deps.identificadores.novoId(),
      apelido,
      ehBot: false,
      conectado: true,
      tokenSessao: this.deps.identificadores.novoToken(),
    };
  }

  private novoBot(sala: Sala): Participante {
    const emUso = new Set(sala.todos.map((p) => p.apelido));
    const nome = APELIDOS_DE_BOT.find((n) => !emUso.has(`Bot ${n}`)) ?? String(sala.todos.length);
    return {
      id: this.deps.identificadores.novoId(),
      apelido: `Bot ${nome}`,
      ehBot: true,
      conectado: true,
      tokenSessao: null,
    };
  }

  private sessao(sala: Sala, participante: Participante): SessaoJogador {
    return {
      codigoSala: sala.codigo,
      jogadorId: participante.id,
      tokenSessao: participante.tokenSessao as string,
    };
  }
}

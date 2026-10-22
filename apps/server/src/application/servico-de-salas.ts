import {
  CONFIGURACAO_PADRAO,
  LIMITES,
  type ConfiguracaoPartida,
  type Reacao,
  type SessaoJogador,
} from '@fodinha/shared';
import type { GeradorAleatorio } from '../domain/aleatoriedade';
import { ErroDeRegra } from '../domain/erros';
import { Sala, type Expulsao, type Participante } from '../domain/sala';
import { normalizarApelido, normalizarCodigoSala, normalizarDispositivo } from './apelido';
import type { CondutorDePartidas } from './condutor-de-partidas';
import type {
  Cancelamento,
  GeradorDeIdentificadores,
  RepositorioDeSalas,
  Registrador,
  Relogio,
} from './portas';

/** Um por sala, sorteado entre os que ainda não estão na mesa (o selo "Bot" vem de `ehBot`). */
const APELIDOS_DE_BOT = [
  'Paula Tejano',
  'Simas Turbo',
  'Toko Kunavara',
  'Jacinto Leite',
  'Oscar Alho',
  'Tomás Turbando',
];
/** Só o cenário de teste passa de 6 bots: depois dos sorteados, estes, em ordem. */
const APELIDOS_RESERVA_DE_BOT = ['Zé', 'Dona Cida', 'Tião', 'Lurdinha', 'Juca'];

// Quatro baralhos sem 8-9-10 e vidas cheias: o maior palco possível para testar mesas lotadas.
const CONFIGURACAO_DE_CENARIO: ConfiguracaoPartida = {
  quantidadeBaralhos: LIMITES.maxBaralhos,
  vidasIniciais: LIMITES.maxVidas,
  incluirOitoNoveDez: false,
  mortosVeemCartas: false,
  prazoDaVezSegundos: CONFIGURACAO_PADRAO.prazoDaVezSegundos,
};

/** Evita que alguém inunde a mesa de emojis; vale por jogador, além do limitador do socket. */
const INTERVALO_ENTRE_REACOES_MS = 1_500;

function inteiroEntre(valor: number, minimo: number, maximo: number): number | null {
  return Number.isInteger(valor) && valor >= minimo && valor <= maximo ? valor : null;
}

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
  private readonly ultimaReacaoEm = new Map<string, number>();

  constructor(private readonly deps: DependenciasDoServico) {}

  criarSala(dados: {
    apelido: string;
    configuracao: ConfiguracaoPartida;
    dispositivoId: string;
  }): SessaoJogador {
    const criador = this.novoHumano(
      normalizarApelido(dados.apelido),
      normalizarDispositivo(dados.dispositivoId),
    );
    const sala = new Sala(this.codigoLivre(), criador, dados.configuracao);
    return this.abrirSala(sala, criador);
  }

  /**
   * Só para desenvolvimento (o gateway barra quando a flag está desligada): sala lotada de bots
   * já em partida, para testar mesas cheias sem precisar de outras pessoas.
   */
  criarCenario(dados: {
    apelido: string;
    dispositivoId: string;
    jogadores: number;
    cartas: number;
  }): SessaoJogador {
    const jogadores = inteiroEntre(dados.jogadores, LIMITES.minJogadores, LIMITES.maxJogadores);
    const cartas = inteiroEntre(dados.cartas, 1, Number.MAX_SAFE_INTEGER);
    if (jogadores === null || cartas === null) {
      throw new ErroDeRegra(
        'ENTRADA_INVALIDA',
        `Cenário inválido: jogadores de ${LIMITES.minJogadores} a ${LIMITES.maxJogadores} e cartas a partir de 1.`,
      );
    }
    const criador = this.novoHumano(
      normalizarApelido(dados.apelido),
      normalizarDispositivo(dados.dispositivoId),
    );
    const sala = new Sala(this.codigoLivre(), criador, CONFIGURACAO_DE_CENARIO, {
      maxBots: LIMITES.maxJogadores - 1,
    });
    for (let i = 1; i < jogadores; i++) sala.adicionarBot(criador.id, this.novoBot(sala));
    sala.iniciarPartida(criador.id, this.deps.gerarAleatorio, cartas);
    return this.abrirSala(sala, criador);
  }

  private abrirSala(sala: Sala, criador: Participante): SessaoJogador {
    this.deps.repositorio.salvar(sala);
    this.deps.registrador.info({ sala: sala.codigo }, 'Sala criada');
    this.deps.condutor.aposMudanca(sala);
    return this.sessao(sala, criador);
  }

  /** Funciona também com partida em andamento: quem entra senta na próxima rodada. */
  entrarSala(dados: { codigoSala: string; apelido: string; dispositivoId: string }): SessaoJogador {
    const sala = this.salaExistente(normalizarCodigoSala(dados.codigoSala));
    const participante = this.novoHumano(
      normalizarApelido(dados.apelido),
      normalizarDispositivo(dados.dispositivoId),
    );
    sala.adicionarHumano(participante);
    this.cancelarLimpeza(sala.codigo);
    this.deps.condutor.aposMudanca(sala);
    return this.sessao(sala, participante);
  }

  reconectar(dados: {
    codigoSala: string;
    tokenSessao: string;
    dispositivoId: string;
  }): SessaoJogador {
    normalizarDispositivo(dados.dispositivoId);
    const sala = this.salaExistente(normalizarCodigoSala(dados.codigoSala));
    const participante = sala.participantePorToken(dados.tokenSessao);
    if (!participante) {
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

  /** A pausa (e a votação) só começa se a queda durar mais que a carência; o condutor a arma. */
  desconectar(ator: Ator): void {
    const sala = this.deps.repositorio.buscar(ator.codigoSala);
    if (!sala?.participante(ator.jogadorId)) return;
    sala.marcarConexao(ator.jogadorId, false);
    if (sala.humanosConectados === 0) this.agendarLimpeza(sala);
    this.deps.condutor.aposMudanca(sala);
  }

  configurar(ator: Ator, configuracao: ConfiguracaoPartida): void {
    this.alterar(ator, (sala) => sala.configurar(ator.jogadorId, configuracao));
  }

  definirMortosVeemCartas(ator: Ator, permitir: boolean): void {
    this.alterar(ator, (sala) => sala.definirMortosVeemCartas(ator.jogadorId, permitir));
  }

  adicionarBot(ator: Ator): void {
    this.alterar(ator, (sala) => sala.adicionarBot(ator.jogadorId, this.novoBot(sala)));
  }

  expulsar(ator: Ator, participanteId: string): Expulsao {
    return this.alterar(ator, (sala) => {
      const expulsao = sala.expulsar(ator.jogadorId, participanteId);
      this.resolverVotacoes(sala);
      this.deps.registrador.info({ sala: sala.codigo }, 'Participante expulso');
      return expulsao;
    });
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

  reiniciar(ator: Ator): void {
    this.alterar(ator, (sala) => {
      sala.reiniciar(ator.jogadorId, this.deps.gerarAleatorio);
      this.deps.registrador.info({ sala: sala.codigo }, 'Sala reiniciada');
    });
  }

  pausar(ator: Ator): void {
    this.alterar(ator, (sala) => {
      sala.pausar(ator.jogadorId);
      this.deps.registrador.info({ sala: sala.codigo }, 'Partida pausada pelo dono');
    });
  }

  retomar(ator: Ator): void {
    this.alterar(ator, (sala) => {
      sala.retomar(ator.jogadorId);
      this.deps.registrador.info({ sala: sala.codigo }, 'Partida retomada pelo dono');
    });
  }

  lerRegras(ator: Ator): void {
    this.alterar(ator, (sala) => {
      sala.comecarLeituraDasRegras(ator.jogadorId, this.deps.relogio.agora());
      this.deps.registrador.info({ sala: sala.codigo }, 'Partida pausada para leitura das regras');
    });
  }

  pararDeLerRegras(ator: Ator): void {
    this.alterar(ator, (sala) => sala.encerrarLeituraDasRegras(ator.jogadorId));
  }

  sair(ator: Ator): void {
    const sala = this.salaExistente(ator.codigoSala);
    sala.sair(ator.jogadorId);
    this.ultimaReacaoEm.delete(ator.jogadorId);
    if (sala.humanosPresentes === 0) {
      this.removerSala(sala);
      return;
    }
    // Sobrou gente na sala, mas talvez ninguém conectado: a sala não pode ficar para sempre.
    if (sala.humanosConectados === 0) this.agendarLimpeza(sala);
    this.resolverVotacoes(sala);
    this.deps.condutor.aposMudanca(sala);
  }

  votarEspera(ator: Ator, { ausenteId, esperar }: { ausenteId: string; esperar: boolean }): void {
    this.alterar(ator, (sala) => {
      sala.votar(ator.jogadorId, ausenteId, esperar);
      this.resolverVotacoes(sala);
    });
  }

  palpitar(ator: Ator, quantidade: number): void {
    this.alterar(ator, (sala) => this.partidaEmJogo(sala).palpitar(ator.jogadorId, quantidade));
  }

  jogarCarta(ator: Ator, cartaId: string): void {
    this.alterar(ator, (sala) => this.partidaEmJogo(sala).jogarCarta(ator.jogadorId, cartaId));
  }

  /** Não passa por `alterar`: reação não muda a sala, então não há estado a republicar. */
  reagir(ator: Ator, reacao: Reacao): void {
    const sala = this.salaExistente(ator.codigoSala);
    const participante = sala.participante(ator.jogadorId);
    if (!participante || participante.saindo) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Você não está nesta sala.');
    }
    if (!sala.emPartida) {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Não há partida em andamento.');
    }
    const agora = this.deps.relogio.agora();
    const ultima = this.ultimaReacaoEm.get(ator.jogadorId);
    if (ultima !== undefined && agora - ultima < INTERVALO_ENTRE_REACOES_MS) {
      throw new ErroDeRegra('MUITAS_REQUISICOES', 'Calma! Espere um instante para reagir de novo.');
    }
    this.ultimaReacaoEm.set(ator.jogadorId, agora);
    this.deps.condutor.publicarReacao(sala, {
      jogadorId: ator.jogadorId,
      reacao,
      em: agora,
    });
  }

  private alterar<T>(ator: Ator, mudanca: (sala: Sala) => T): T {
    const sala = this.salaExistente(ator.codigoSala);
    const participante = sala.participante(ator.jogadorId);
    if (!participante || participante.saindo) {
      throw new ErroDeRegra('SEM_PERMISSAO', 'Você não está nesta sala.');
    }
    const resultado = mudanca(sala);
    this.deps.condutor.aposMudanca(sala);
    return resultado;
  }

  private partidaEmJogo(sala: Sala) {
    if (!sala.emPartida || !sala.partida) {
      throw new ErroDeRegra('JOGADA_INVALIDA', 'Não há partida em andamento.');
    }
    if (sala.pausada) {
      throw new ErroDeRegra('JOGO_PAUSADO', 'A partida está pausada.');
    }
    return sala.partida;
  }

  private resolverVotacoes(sala: Sala): void {
    const eliminados = sala.resolverVotacoes();
    if (eliminados.length === 0) return;
    this.deps.registrador.info(
      { sala: sala.codigo, quantidade: eliminados.length },
      'Ausente eliminado por votação',
    );
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
      if (sala.humanosConectados === 0) this.removerSala(sala);
    });
    this.limpezasAgendadas.set(sala.codigo, cancelar);
  }

  private cancelarLimpeza(codigo: string): void {
    this.limpezasAgendadas.get(codigo)?.();
    this.limpezasAgendadas.delete(codigo);
  }

  private removerSala(sala: Sala): void {
    this.cancelarLimpeza(sala.codigo);
    for (const p of sala.todos) this.ultimaReacaoEm.delete(p.id);
    this.deps.condutor.encerrar(sala.codigo);
    this.deps.repositorio.remover(sala.codigo);
    this.deps.registrador.info({ sala: sala.codigo }, 'Sala removida');
  }

  private codigoLivre(): string {
    let codigo = this.deps.identificadores.novoCodigoSala();
    while (this.deps.repositorio.existe(codigo))
      codigo = this.deps.identificadores.novoCodigoSala();
    return codigo;
  }

  private novoHumano(apelido: string, dispositivoId: string): Participante {
    return {
      id: this.deps.identificadores.novoId(),
      apelido,
      ehBot: false,
      perfilDoBot: null,
      conectado: true,
      saindo: false,
      tokenSessao: this.deps.identificadores.novoToken(),
      dispositivoId,
    };
  }

  private novoBot(sala: Sala): Participante {
    const emUso = new Set(sala.todos.map((p) => p.apelido));
    const livres = APELIDOS_DE_BOT.filter((nome) => !emUso.has(nome));
    const sorteado = livres[Math.floor(this.deps.gerarAleatorio() * livres.length)];
    const apelido =
      sorteado ??
      APELIDOS_RESERVA_DE_BOT.find((nome) => !emUso.has(nome)) ??
      `Bot ${sala.todos.length}`;
    return {
      id: this.deps.identificadores.novoId(),
      apelido,
      ehBot: true,
      perfilDoBot: null,
      conectado: true,
      saindo: false,
      tokenSessao: null,
      dispositivoId: null,
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

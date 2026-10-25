import type {
  EstadoPartidaVisivel,
  EstadoSala,
  EventosClienteParaServidor,
  EventosServidorParaCliente,
  ReacaoNaMesa,
  Resposta,
  SessaoJogador,
} from '@fodinha/shared';
import type { Server, Socket } from 'socket.io';
import type { Login, Notificador, Registrador } from '../../application/portas';
import type { Ator, ServicoDeSalas } from '../../application/servico-de-salas';
import { ErroDeRegra } from '../../domain/erros';
import {
  lerCarta,
  lerCenario,
  lerConfiguracao,
  lerCriacao,
  lerEntrada,
  lerExpulsao,
  lerMortosVeemCartas,
  lerPalpite,
  lerReacao,
  lerReconexao,
  lerTokenDeLogin,
  lerVoto,
} from './entradas';
import { contaOuConvidado } from '../login/conta-ou-convidado';
import { LimitadorDeEventos } from './limitador';

interface DadosDoSocket {
  ator?: Ator;
  /** Conta conferida no aperto de mão; `null` = convidado. O payload nunca a informa. */
  contaId?: string | null;
}

export type ServidorDoJogo = Server<
  EventosClienteParaServidor,
  EventosServidorParaCliente,
  Record<string, never>,
  DadosDoSocket
>;
type SocketDoJogo = Socket<
  EventosClienteParaServidor,
  EventosServidorParaCliente,
  Record<string, never>,
  DadosDoSocket
>;

const canalDoJogador = (jogadorId: string) => `jogador:${jogadorId}`;

export class NotificadorSocketIo implements Notificador {
  constructor(private readonly io: ServidorDoJogo) {}

  enviarEstadoSala(destinatarioIds: readonly string[], estado: EstadoSala): void {
    if (destinatarioIds.length === 0) return;
    this.io.to(destinatarioIds.map(canalDoJogador)).emit('sala:estado', estado);
  }

  enviarEstadoPartida(destinatarioId: string, estado: EstadoPartidaVisivel): void {
    this.io.to(canalDoJogador(destinatarioId)).emit('jogo:estado', estado);
  }

  enviarReacao(destinatarioIds: readonly string[], reacao: ReacaoNaMesa): void {
    if (destinatarioIds.length === 0) return;
    this.io.to(destinatarioIds.map(canalDoJogador)).emit('jogo:reacao', reacao);
  }
}

export interface OpcoesDoGateway {
  /** Só para desenvolvimento: libera o evento `dev:cenario`. */
  readonly cenariosDeTeste?: boolean;
  /** Confere o token de login do aperto de mão; ausente = todos convidados. */
  readonly login?: Pick<Login, 'ligado' | 'contaDoToken'>;
}

/**
 * Traduz eventos de socket em casos de uso. A identidade de quem age vem SEMPRE da sessão
 * vinculada ao socket (definida no servidor), nunca de um campo do payload.
 */
export class GatewayDoJogo {
  private readonly socketsPorJogador = new Map<string, Set<string>>();
  private readonly limitador = new LimitadorDeEventos();

  constructor(
    private readonly io: ServidorDoJogo,
    private readonly servico: ServicoDeSalas,
    private readonly registrador: Registrador,
    private readonly opcoes: OpcoesDoGateway = {},
  ) {}

  iniciar(): void {
    this.io.use((socket, seguir) => {
      void this.identificarConta(socket).then(() => seguir());
    });
    this.io.on('connection', (socket) => this.registrarEventos(socket));
  }

  /** Confere o token do aperto de mão uma vez por conexão; falha = convidado, nunca recusa. */
  private async identificarConta(socket: SocketDoJogo): Promise<void> {
    const token = lerTokenDeLogin(socket.handshake.auth);
    const login = this.opcoes.login;
    if (token === null || !login?.ligado) {
      socket.data.contaId = null;
      return;
    }
    const conta = await contaOuConvidado(login, token, this.registrador);
    socket.data.contaId = conta?.id ?? null;
  }

  private contaDe(socket: SocketDoJogo): string | null {
    return socket.data.contaId ?? null;
  }

  private registrarEventos(socket: SocketDoJogo): void {
    socket.on('sala:criar', (dados, responder) =>
      this.responder(socket, responder, () =>
        this.entrarComSessao(
          socket,
          this.servico.criarSala({ ...lerCriacao(dados), contaId: this.contaDe(socket) }),
        ),
      ),
    );
    socket.on('dev:cenario', (dados, responder) =>
      this.responder(socket, responder, () => {
        if (!this.opcoes.cenariosDeTeste) {
          throw new ErroDeRegra('SEM_PERMISSAO', 'Cenários de teste desativados neste servidor.');
        }
        return this.entrarComSessao(socket, this.servico.criarCenario(lerCenario(dados)));
      }),
    );
    socket.on('sala:entrar', (dados, responder) =>
      this.responder(socket, responder, () =>
        this.entrarComSessao(
          socket,
          this.servico.entrarSala({ ...lerEntrada(dados), contaId: this.contaDe(socket) }),
        ),
      ),
    );
    socket.on('sala:reconectar', (dados, responder) =>
      this.responder(socket, responder, () =>
        this.entrarComSessao(socket, this.servico.reconectar(lerReconexao(dados))),
      ),
    );
    socket.on('sala:configurar', (dados, responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.configurar(this.ator(socket), lerConfiguracao(dados))),
      ),
    );
    socket.on('sala:definirMortosVeemCartas', (dados, responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.definirMortosVeemCartas(this.ator(socket), lerMortosVeemCartas(dados))),
      ),
    );
    socket.on('sala:adicionarBot', (responder) =>
      this.responder(socket, responder, () => nulo(this.servico.adicionarBot(this.ator(socket)))),
    );
    socket.on('sala:expulsar', (dados, responder) =>
      this.responder(socket, responder, () => {
        const expulsao = this.servico.expulsar(this.ator(socket), lerExpulsao(dados));
        if (expulsao.eraHumano) this.retirarExpulso(expulsao.expulsoId);
        return null;
      }),
    );
    socket.on('sala:iniciarPartida', (responder) =>
      this.responder(socket, responder, () => nulo(this.servico.iniciarPartida(this.ator(socket)))),
    );
    socket.on('sala:reiniciar', (responder) =>
      this.responder(socket, responder, () => nulo(this.servico.reiniciar(this.ator(socket)))),
    );
    socket.on('sala:pausar', (responder) =>
      this.responder(socket, responder, () => nulo(this.servico.pausar(this.ator(socket)))),
    );
    socket.on('sala:retomar', (responder) =>
      this.responder(socket, responder, () => nulo(this.servico.retomar(this.ator(socket)))),
    );
    socket.on('jogo:lerRegras', (responder) =>
      this.responder(socket, responder, () => nulo(this.servico.lerRegras(this.ator(socket)))),
    );
    socket.on('jogo:pararDeLerRegras', (responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.pararDeLerRegras(this.ator(socket))),
      ),
    );
    socket.on('jogo:votarEspera', (dados, responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.votarEspera(this.ator(socket), lerVoto(dados))),
      ),
    );
    socket.on('sala:sair', (responder) =>
      this.responder(socket, responder, () => {
        this.servico.sair(this.ator(socket));
        this.desvincular(socket);
        return null;
      }),
    );
    socket.on('jogo:palpitar', (dados, responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.palpitar(this.ator(socket), lerPalpite(dados))),
      ),
    );
    socket.on('jogo:jogarCarta', (dados, responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.jogarCarta(this.ator(socket), lerCarta(dados))),
      ),
    );
    socket.on('jogo:reagir', (dados, responder) =>
      this.responder(socket, responder, () =>
        nulo(this.servico.reagir(this.ator(socket), lerReacao(dados))),
      ),
    );
    socket.on('disconnect', () => {
      this.limitador.esquecer(socket.id);
      const ator = this.desvincular(socket);
      if (ator && !this.socketsPorJogador.has(ator.jogadorId)) this.servico.desconectar(ator);
    });
  }

  /** Ponto único de tratamento de erros dos eventos. */
  private responder<T>(socket: SocketDoJogo, responder: unknown, acao: () => T): void {
    // Cliente que não manda callback não recebe resposta — e não executa nada.
    if (typeof responder !== 'function') return;
    const enviar = responder as (resposta: Resposta<T>) => void;

    if (!this.limitador.permitir(socket.id)) {
      enviar({
        ok: false,
        erro: { codigo: 'MUITAS_REQUISICOES', mensagem: 'Calma! Muitas ações em pouco tempo.' },
      });
      return;
    }
    try {
      enviar({ ok: true, dados: acao() });
    } catch (erro) {
      if (erro instanceof ErroDeRegra) {
        enviar({ ok: false, erro: { codigo: erro.codigo, mensagem: erro.message } });
        return;
      }
      this.registrador.error({ erro, socket: socket.id }, 'Erro inesperado ao tratar evento');
      enviar({
        ok: false,
        erro: { codigo: 'ERRO_INTERNO', mensagem: 'Algo deu errado no servidor. Tente novamente.' },
      });
    }
  }

  private entrarComSessao(socket: SocketDoJogo, sessao: SessaoJogador): SessaoJogador {
    const anterior = this.desvincular(socket);
    if (
      anterior &&
      anterior.jogadorId !== sessao.jogadorId &&
      !this.socketsPorJogador.has(anterior.jogadorId)
    ) {
      this.servico.desconectar(anterior);
    }
    socket.data.ator = { codigoSala: sessao.codigoSala, jogadorId: sessao.jogadorId };
    socket.join(canalDoJogador(sessao.jogadorId));
    const sockets = this.socketsPorJogador.get(sessao.jogadorId) ?? new Set<string>();
    this.socketsPorJogador.set(sessao.jogadorId, sockets.add(socket.id));
    // O caso de uso publicou antes de o socket entrar no canal: reenvia o estado para ele.
    this.servico.republicar(sessao.codigoSala);
    return sessao;
  }

  private desvincular(socket: SocketDoJogo): Ator | undefined {
    const ator = socket.data.ator;
    if (!ator) return undefined;
    socket.leave(canalDoJogador(ator.jogadorId));
    socket.data.ator = undefined;
    const sockets = this.socketsPorJogador.get(ator.jogadorId);
    sockets?.delete(socket.id);
    if (sockets?.size === 0) this.socketsPorJogador.delete(ator.jogadorId);
    return ator;
  }

  /** Avisa todas as abas do expulso e as desvincula, para que ele não continue agindo na sala. */
  private retirarExpulso(jogadorId: string): void {
    this.io.to(canalDoJogador(jogadorId)).emit('sala:expulso', {
      mensagem: 'O dono da sala removeu você. Você não pode voltar a ela.',
    });
    for (const socketId of [...(this.socketsPorJogador.get(jogadorId) ?? [])]) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) this.desvincular(socket);
    }
  }

  private ator(socket: SocketDoJogo): Ator {
    const ator = socket.data.ator;
    if (!ator) throw new ErroDeRegra('SEM_PERMISSAO', 'Entre em uma sala primeiro.');
    return ator;
  }
}

function nulo(_: void): null {
  return null;
}

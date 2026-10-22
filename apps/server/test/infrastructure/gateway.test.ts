import { createServer, type Server as ServidorHttp } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  CONFIGURACAO_PADRAO,
  type EstadoPartidaVisivel,
  type EstadoSala,
  type EventosClienteParaServidor,
  type EventosServidorParaCliente,
  type ReacaoNaMesa,
  type Resposta,
  type SessaoJogador,
} from '@fodinha/shared';
import { Server } from 'socket.io';
import { io as conectarCliente, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CondutorDePartidas } from '../../src/application/condutor-de-partidas';
import { ServicoDeSalas } from '../../src/application/servico-de-salas';
import { criarEstrategiasDosPerfis } from '../../src/domain/estrategia-bot';
import {
  aleatorioCriptografico,
  IdentificadoresCriptograficos,
  RelogioDoSistema,
  RepositorioDeSalasEmMemoria,
} from '../../src/infrastructure/adaptadores';
import {
  GatewayDoJogo,
  NotificadorSocketIo,
  type ServidorDoJogo,
} from '../../src/infrastructure/socket/gateway';
import { BOT_SEM_ERRO, BOTS_CALADOS } from '../apoio';

const CARENCIA_MS = 200;
const ESPERA_MAXIMA_MS = 3_000;

type SocketCliente = Socket<EventosServidorParaCliente, EventosClienteParaServidor>;

const silencioso = { info: () => {}, warn: () => {}, error: () => {} };

/** Cliente real que acumula tudo o que o servidor envia, para os testes aguardarem por predicado. */
class ClienteDeTeste {
  readonly salas: EstadoSala[] = [];
  readonly jogos: EstadoPartidaVisivel[] = [];
  readonly expulsoes: { mensagem: string }[] = [];
  readonly reacoes: ReacaoNaMesa[] = [];
  private readonly ouvintes = new Set<() => void>();

  constructor(readonly socket: SocketCliente) {
    socket.on('sala:estado', (estado) => this.registrar(this.salas, estado));
    socket.on('jogo:estado', (estado) => this.registrar(this.jogos, estado));
    socket.on('sala:expulso', (aviso) => this.registrar(this.expulsoes, aviso));
    socket.on('jogo:reacao', (reacao) => this.registrar(this.reacoes, reacao));
  }

  private registrar<T>(lista: T[], item: T): void {
    lista.push(item);
    for (const ouvinte of [...this.ouvintes]) ouvinte();
  }

  /** Resolve assim que `obter` devolver um valor (inclusive para eventos que já chegaram). */
  aguardar<T>(obter: () => T | undefined, descricao: string): Promise<T> {
    return new Promise<T>((resolver, rejeitar) => {
      const encerrar = () => {
        clearTimeout(limite);
        this.ouvintes.delete(tentar);
      };
      const tentar = () => {
        const valor = obter();
        if (valor === undefined) return;
        encerrar();
        resolver(valor);
      };
      const limite = setTimeout(() => {
        encerrar();
        rejeitar(new Error(`Tempo esgotado aguardando: ${descricao}`));
      }, ESPERA_MAXIMA_MS);
      this.ouvintes.add(tentar);
      tentar();
    });
  }

  aguardarSala(predicado: (estado: EstadoSala) => boolean, descricao: string) {
    return this.aguardar(() => this.salas.find(predicado), descricao);
  }

  aguardarJogo(predicado: (estado: EstadoPartidaVisivel) => boolean, descricao: string) {
    return this.aguardar(() => this.jogos.find(predicado), descricao);
  }

  aguardarExpulsao() {
    return this.aguardar(() => this.expulsoes[0], 'sala:expulso');
  }

  /** Emite um evento e aguarda o ack, com o mesmo tipo de resposta do contrato. */
  emitir<T>(enviar: (responder: (resposta: Resposta<T>) => void) => void): Promise<Resposta<T>> {
    return new Promise((resolver, rejeitar) => {
      const limite = setTimeout(() => rejeitar(new Error('Sem ack do servidor')), ESPERA_MAXIMA_MS);
      enviar((resposta) => {
        clearTimeout(limite);
        resolver(resposta);
      });
    });
  }
}

let http: ServidorHttp;
let io: ServidorDoJogo;
let url: string;
let clientes: ClienteDeTeste[];

beforeEach(async () => {
  clientes = [];
  http = createServer();
  io = new Server(http);
  const relogio = new RelogioDoSistema();
  const condutor = new CondutorDePartidas({
    notificador: new NotificadorSocketIo(io),
    relogio,
    estrategias: criarEstrategiasDosPerfis(BOT_SEM_ERRO),
    registrador: silencioso,
    gerarAleatorio: BOTS_CALADOS,
    tempos: {
      atrasoDoBotMs: 20,
      pausaFimDeRodadaMs: 20,
      pausaExtraRodadaCegaMs: 0,
      carenciaDeDesconexaoMs: CARENCIA_MS,
    },
  });
  const servico = new ServicoDeSalas({
    repositorio: new RepositorioDeSalasEmMemoria(),
    condutor,
    identificadores: new IdentificadoresCriptograficos(),
    relogio,
    gerarAleatorio: aleatorioCriptografico,
    registrador: silencioso,
    tempoDeAbandonoMs: 600_000,
  });
  new GatewayDoJogo(io, servico, silencioso).iniciar();
  await new Promise<void>((resolver) => http.listen(0, '127.0.0.1', resolver));
  url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

afterEach(async () => {
  for (const cliente of clientes) cliente.socket.disconnect();
  await new Promise<void>((resolver) => io.close(() => resolver()));
});

async function conectar(): Promise<ClienteDeTeste> {
  const socket: SocketCliente = conectarCliente(url, {
    transports: ['websocket'],
    reconnection: false,
  });
  const cliente = new ClienteDeTeste(socket);
  clientes.push(cliente);
  await new Promise<void>((resolver, rejeitar) => {
    socket.once('connect', resolver);
    socket.once('connect_error', rejeitar);
  });
  return cliente;
}

function dadosDe<T>(resposta: Resposta<T>): T {
  if (!resposta.ok) throw new Error(`Resposta de erro inesperada: ${resposta.erro.codigo}`);
  return resposta.dados;
}

function criarSala(cliente: ClienteDeTeste, apelido = 'Ana', dispositivoId = 'disp-ana') {
  return cliente.emitir<SessaoJogador>((r) =>
    cliente.socket.emit(
      'sala:criar',
      { apelido, configuracao: CONFIGURACAO_PADRAO, dispositivoId },
      r,
    ),
  );
}

function entrarNaSala(
  cliente: ClienteDeTeste,
  codigoSala: string,
  apelido: string,
  dispositivoId: string,
) {
  return cliente.emitir<SessaoJogador>((r) =>
    cliente.socket.emit('sala:entrar', { codigoSala, apelido, dispositivoId }, r),
  );
}

/** Socket sem tipagem de contrato: simula um cliente malicioso que manda qualquer payload. */
const semContrato = (cliente: ClienteDeTeste) => cliente.socket as unknown as Socket;

describe('GatewayDoJogo (integração com Socket.IO real)', () => {
  it('devePublicarSalaComDoisParticipantesQuandoSegundoClienteEntra', async () => {
    const dono = await conectar();
    const convidado = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));

    dadosDe(await entrarNaSala(convidado, sessaoDono.codigoSala, 'Beto', 'disp-beto'));

    for (const cliente of [dono, convidado]) {
      const estado = await cliente.aguardarSala(
        (e) => e.participantes.length === 2,
        'sala com 2 participantes',
      );
      expect(estado.codigo).toBe(sessaoDono.codigoSala);
      expect(estado.participantes.map((p) => p.apelido).sort()).toEqual(['Ana', 'Beto']);
    }
  });

  it('deveExpulsarEBanirPeloDispositivoQuandoDonoExpulsaConvidado', async () => {
    const dono = await conectar();
    const convidado = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));
    const sessaoConvidado = dadosDe(
      await entrarNaSala(convidado, sessaoDono.codigoSala, 'Beto', 'disp-beto'),
    );

    dadosDe(
      await dono.emitir((r) =>
        dono.socket.emit('sala:expulsar', { participanteId: sessaoConvidado.jogadorId }, r),
      ),
    );

    const aviso = await convidado.aguardarExpulsao();
    expect(aviso.mensagem.length).toBeGreaterThan(0);

    const acaoPosterior = await convidado.emitir((r) =>
      convidado.socket.emit('sala:adicionarBot', r),
    );
    expect(acaoPosterior).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });

    const mesmoDispositivo = await entrarNaSala(
      convidado,
      sessaoDono.codigoSala,
      'Beto',
      'disp-beto',
    );
    expect(mesmoDispositivo).toMatchObject({ ok: false, erro: { codigo: 'BANIDO' } });

    const outroDispositivo = await entrarNaSala(
      convidado,
      sessaoDono.codigoSala,
      'Beto',
      'disp-outro',
    );
    expect(outroDispositivo.ok).toBe(true);
  });

  it('deveResponderEntradaInvalidaSemDerrubarServidorQuandoPayloadEhInvalido', async () => {
    const dono = await conectar();
    const cliente = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));
    const emitirCru = (dados: unknown) =>
      cliente.emitir<SessaoJogador>((r) => semContrato(cliente).emit('sala:entrar', dados, r));

    const apelidoNumerico = await emitirCru({
      codigoSala: sessaoDono.codigoSala,
      apelido: 42,
      dispositivoId: 'disp-x',
    });
    expect(apelidoNumerico).toMatchObject({ ok: false, erro: { codigo: 'ENTRADA_INVALIDA' } });

    const semDispositivo = await emitirCru({ codigoSala: sessaoDono.codigoSala, apelido: 'Cris' });
    expect(semDispositivo).toMatchObject({ ok: false, erro: { codigo: 'ENTRADA_INVALIDA' } });

    const corpoNaoObjeto = await emitirCru('lixo');
    expect(corpoNaoObjeto).toMatchObject({ ok: false, erro: { codigo: 'ENTRADA_INVALIDA' } });

    const valida = await entrarNaSala(cliente, sessaoDono.codigoSala, 'Cris', 'disp-cris');
    expect(valida.ok).toBe(true);
  });

  it('deveResponderSemPermissaoQuandoNaoDonoReinicia', async () => {
    const dono = await conectar();
    const convidado = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));
    dadosDe(await entrarNaSala(convidado, sessaoDono.codigoSala, 'Beto', 'disp-beto'));

    const resposta = await convidado.emitir((r) => convidado.socket.emit('sala:reiniciar', r));

    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });

  it('devePausarEDepoisRetomarQuandoHumanoCaiEOutroVotaParaNaoEsperar', async () => {
    const dono = await conectar();
    const convidado = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));
    const sessaoConvidado = dadosDe(
      await entrarNaSala(convidado, sessaoDono.codigoSala, 'Beto', 'disp-beto'),
    );
    dadosDe(await dono.emitir((r) => dono.socket.emit('sala:adicionarBot', r)));
    dadosDe(await dono.emitir((r) => dono.socket.emit('sala:iniciarPartida', r)));
    await dono.aguardarJogo((e) => e.pausa === null, 'partida iniciada');

    convidado.socket.disconnect();

    const pausado = await dono.aguardarJogo(
      (e) => e.pausa?.votacoes.some((v) => v.ausenteId === sessaoConvidado.jogadorId) === true,
      'pausa com votação do ausente',
    );
    expect(pausado.pausa?.votacoes).toHaveLength(1);
    const posicaoDaPausa = dono.jogos.indexOf(pausado);

    dadosDe(
      await dono.emitir((r) =>
        dono.socket.emit(
          'jogo:votarEspera',
          { ausenteId: sessaoConvidado.jogadorId, esperar: false },
          r,
        ),
      ),
    );

    const retomado = await dono.aguardar(
      () => dono.jogos.slice(posicaoDaPausa + 1).find((e) => e.pausa === null),
      'jogo:estado sem pausa',
    );
    expect(retomado.pausa).toBeNull();
  });

  it('deveAvisarAMesaQuandoUmJogadorPausaParaLerAsRegras', async () => {
    const dono = await conectar();
    const convidado = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));
    const sessaoConvidado = dadosDe(
      await entrarNaSala(convidado, sessaoDono.codigoSala, 'Beto', 'disp-beto'),
    );
    dadosDe(await dono.emitir((r) => dono.socket.emit('sala:iniciarPartida', r)));
    await dono.aguardarJogo((e) => e.pausa === null, 'partida iniciada');

    dadosDe(await convidado.emitir((r) => convidado.socket.emit('jogo:lerRegras', r)));
    const lendo = await dono.aguardarJogo(
      (e) => e.pausa?.lendoRegras?.jogadorId === sessaoConvidado.jogadorId,
      'pausa de leitura das regras',
    );
    const posicao = dono.jogos.indexOf(lendo);

    const repetida = await convidado.emitir((r) => convidado.socket.emit('jogo:lerRegras', r));
    expect(repetida).toMatchObject({ ok: false, erro: { codigo: 'ENTRADA_INVALIDA' } });

    dadosDe(await convidado.emitir((r) => convidado.socket.emit('jogo:pararDeLerRegras', r)));
    const retomado = await dono.aguardar(
      () => dono.jogos.slice(posicao + 1).find((e) => e.pausa === null),
      'jogo:estado sem pausa',
    );
    expect(retomado.pausa).toBeNull();
  });

  it('deveIgnorarEventoSemCallbackDeAckQuandoClienteNaoPedeResposta', async () => {
    const cliente = await conectar();

    semContrato(cliente).emit('sala:criar', {
      apelido: 'Sem ack',
      configuracao: CONFIGURACAO_PADRAO,
      dispositivoId: 'disp-sem-ack',
    });
    semContrato(cliente).emit('sala:adicionarBot');

    // O servidor continua de pé e nada foi executado: o evento posterior com ack é atendido.
    const resposta = await criarSala(cliente, 'Dani', 'disp-dani');
    expect(resposta.ok).toBe(true);
    expect(cliente.socket.connected).toBe(true);
    expect(io.engine.clientsCount).toBe(1);
  });
});

describe('GatewayDoJogo — cenários de teste', () => {
  it('deveRecusarDevCenarioComSemPermissaoQuandoAFlagEstaDesligada', async () => {
    const cliente = await conectar();

    const resposta = await cliente.emitir<SessaoJogador>((r) =>
      cliente.socket.emit(
        'dev:cenario',
        { apelido: 'Ana', jogadores: 10, cartas: 13, dispositivoId: 'disp-ana' },
        r,
      ),
    );

    expect(resposta).toMatchObject({ ok: false, erro: { codigo: 'SEM_PERMISSAO' } });
  });
});

describe('GatewayDoJogo — reações', () => {
  async function mesaComDoisClientes() {
    const dono = await conectar();
    const convidado = await conectar();
    const sessaoDono = dadosDe(await criarSala(dono));
    const sessaoConvidado = dadosDe(
      await entrarNaSala(convidado, sessaoDono.codigoSala, 'Beto', 'disp-beto'),
    );
    dadosDe(await dono.emitir<null>((r) => dono.socket.emit('sala:iniciarPartida', r)));
    return { dono, convidado, sessaoConvidado };
  }

  it('deveTransmitirReacaoParaTodosDaSalaIncluindoQuemReagiu', async () => {
    const { dono, convidado, sessaoConvidado } = await mesaComDoisClientes();

    const resposta = await convidado.emitir<null>((r) =>
      convidado.socket.emit('jogo:reagir', { reacao: '🔥' }, r),
    );

    expect(resposta.ok).toBe(true);
    for (const cliente of [dono, convidado]) {
      const reacao = await cliente.aguardar(() => cliente.reacoes[0], 'jogo:reacao');
      expect(reacao).toMatchObject({ jogadorId: sessaoConvidado.jogadorId, reacao: '🔥' });
    }
  });

  it('deveRejeitarReacaoInvalidaEBloquearSpam', async () => {
    const { dono, convidado } = await mesaComDoisClientes();

    const invalida = await convidado.emitir<null>((r) =>
      semContrato(convidado).emit('jogo:reagir', { reacao: 'x' }, r),
    );
    expect(invalida).toMatchObject({ ok: false, erro: { codigo: 'ENTRADA_INVALIDA' } });

    dadosDe(
      await convidado.emitir<null>((r) =>
        convidado.socket.emit('jogo:reagir', { reacao: '😂' }, r),
      ),
    );
    const spam = await convidado.emitir<null>((r) =>
      convidado.socket.emit('jogo:reagir', { reacao: '😂' }, r),
    );
    expect(spam).toMatchObject({ ok: false, erro: { codigo: 'MUITAS_REQUISICOES' } });

    await dono.aguardar(() => dono.reacoes[0], 'jogo:reacao');
    expect(dono.reacoes).toHaveLength(1);
  });
});

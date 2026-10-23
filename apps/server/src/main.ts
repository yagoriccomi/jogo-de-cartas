import cors from '@fastify/cors';
import Fastify from 'fastify';
import { Server } from 'socket.io';
import { PAUSAS_DO_FIM_DE_RODADA } from '@fodinha/shared';
import type { ServidorDoJogo } from './infrastructure/socket/gateway';
import { CondutorDePartidas } from './application/condutor-de-partidas';
import { ServicoDeSalas } from './application/servico-de-salas';
import { criarEstrategiasDosPerfis } from './domain/estrategia-bot';
import {
  aleatorioCriptografico,
  IdentificadoresCriptograficos,
  RelogioDoSistema,
  RepositorioDeSalasEmMemoria,
} from './infrastructure/adaptadores';
import { lerAmbiente } from './infrastructure/ambiente';
import { GatewayDoJogo, NotificadorSocketIo } from './infrastructure/socket/gateway';

const TEMPO_DE_ABANDONO_MS = 10 * 60_000;
// Recarregar a página ou piscar a rede não deve pausar a mesa.
const CARENCIA_DE_DESCONEXAO_MS = 10_000;
// Os eventos do jogo são minúsculos; qualquer coisa maior que isso é abuso.
const TAMANHO_MAXIMO_DE_MENSAGEM = 10_000;

/** Composition root: o único lugar que conhece as implementações concretas. */
async function iniciar(): Promise<void> {
  const ambiente = lerAmbiente();
  const http = Fastify({
    logger: { level: ambiente.nivelDeLog },
    bodyLimit: TAMANHO_MAXIMO_DE_MENSAGEM,
  });
  await http.register(cors, { origin: [...ambiente.origensPermitidas] });

  const io: ServidorDoJogo = new Server(http.server, {
    cors: { origin: [...ambiente.origensPermitidas] },
    maxHttpBufferSize: TAMANHO_MAXIMO_DE_MENSAGEM,
  });

  const repositorio = new RepositorioDeSalasEmMemoria();
  const relogio = new RelogioDoSistema();
  const registrador = http.log;
  const condutor = new CondutorDePartidas({
    notificador: new NotificadorSocketIo(io),
    relogio,
    estrategias: criarEstrategiasDosPerfis(aleatorioCriptografico),
    registrador,
    gerarAleatorio: aleatorioCriptografico,
    tempos: {
      atrasoDoBotMs: ambiente.atrasoDoBotMs,
      // Compartilhadas: o cliente mede a cena da última vaza contra estas mesmas pausas.
      pausaFimDeRodadaMs: PAUSAS_DO_FIM_DE_RODADA.normalMs,
      pausaExtraRodadaCegaMs: PAUSAS_DO_FIM_DE_RODADA.extraDaRodadaCegaMs,
      carenciaDeDesconexaoMs: CARENCIA_DE_DESCONEXAO_MS,
    },
  });
  const servico = new ServicoDeSalas({
    repositorio,
    condutor,
    identificadores: new IdentificadoresCriptograficos(),
    relogio,
    gerarAleatorio: aleatorioCriptografico,
    registrador,
    tempoDeAbandonoMs: TEMPO_DE_ABANDONO_MS,
  });
  new GatewayDoJogo(io, servico, registrador, ambiente.cenariosDeTeste).iniciar();

  // Sondado a cada poucos segundos pelos orquestradores: fora do log de nível info.
  http.get('/health', { logLevel: 'warn' }, async () => ({
    status: 'ok',
    salas: repositorio.quantidade,
    conexoes: io.engine.clientsCount,
  }));

  const desligar = async (sinal: string) => {
    http.log.info({ sinal }, 'Encerrando servidor');
    // io.close() também fecha o servidor HTTP do Fastify, que está por baixo.
    await new Promise<void>((resolver) => io.close(() => resolver()));
    process.exit(0);
  };
  process.on('SIGTERM', () => void desligar('SIGTERM'));
  process.on('SIGINT', () => void desligar('SIGINT'));

  await http.listen({ host: ambiente.host, port: ambiente.porta });
}

iniciar().catch((erro: unknown) => {
  console.error('Falha ao iniciar o servidor', erro);
  process.exit(1);
});

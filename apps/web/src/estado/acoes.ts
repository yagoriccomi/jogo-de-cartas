import type { ConfiguracaoPartida, Reacao, SessaoJogador } from '@fodinha/shared';
import { descreverErro, registrar } from '../lib/log';
import { limparSessao, lerSessao, obterDispositivoId, salvarSessao } from '../lib/sessao';
import { ErroDeRequisicao, requisitar, socket, type Envio } from '../lib/socket';
import { atualizar, avisar, obterEstado, receberDoServidor, registrarReacao } from './armazem';
import { lerCenarioDaUrl, type CenarioDeTeste } from './cenario';
import type { AcoesDaPartida } from './fonteDaPartida';

const MENSAGEM_GENERICA = 'Algo deu errado. Tente novamente.';

/** Ponto único de tratamento: loga o detalhe técnico e mostra só a mensagem limpa ao usuário. */
function tratarErro(operacao: string, erro: unknown): void {
  if (erro instanceof ErroDeRequisicao) {
    registrar('warn', 'requisicao.falhou', {
      operacao,
      codigo: erro.codigo,
      ...descreverErro(erro),
    });
    avisar('erro', erro.message);
    return;
  }
  registrar('error', 'requisicao.erro_inesperado', { operacao, ...descreverErro(erro) });
  avisar('erro', MENSAGEM_GENERICA);
}

/** Executa uma requisição sem dados de retorno; devolve `true` se o servidor aceitou. */
async function comando(operacao: string, enviar: Envio<null>): Promise<boolean> {
  try {
    await requisitar<null>(enviar);
    return true;
  } catch (erro) {
    tratarErro(operacao, erro);
    return false;
  }
}

async function obterSessao(operacao: string, enviar: Envio<SessaoJogador>): Promise<boolean> {
  try {
    const sessao = await requisitar<SessaoJogador>(enviar);
    salvarSessao(sessao);
    atualizar({ sessao, retomando: false, avisoEntrada: null });
    return true;
  } catch (erro) {
    tratarErro(operacao, erro);
    return false;
  }
}

export function criarSala(apelido: string, configuracao: ConfiguracaoPartida): Promise<boolean> {
  const dispositivoId = obterDispositivoId();
  return obterSessao('sala:criar', (r) =>
    socket.emit('sala:criar', { apelido, configuracao, dispositivoId }, r),
  );
}

export function entrarNaSala(codigoSala: string, apelido: string): Promise<boolean> {
  const dispositivoId = obterDispositivoId();
  return obterSessao('sala:entrar', (r) =>
    socket.emit('sala:entrar', { codigoSala, apelido, dispositivoId }, r),
  );
}

const APELIDO_DO_CENARIO = 'Você';

/** Só dev: o servidor recusa (`SEM_PERMISSAO`) se `CENARIOS_DE_TESTE` não estiver ligado. */
export function entrarNoCenario({ jogadores, cartas }: CenarioDeTeste): Promise<boolean> {
  const dispositivoId = obterDispositivoId();
  return obterSessao('dev:cenario', (r) =>
    socket.emit(
      'dev:cenario',
      { apelido: APELIDO_DO_CENARIO, jogadores, cartas, dispositivoId },
      r,
    ),
  );
}

function esquecerSessao(): void {
  limparSessao();
  atualizar({ sessao: null, sala: null, jogo: null, retomando: false, voltouAoLobby: false });
}

/** Tenta reentrar no assento guardado; qualquer falha devolve o usuário à tela inicial. */
export async function retomarSessao(): Promise<void> {
  // A sessão do tutorial é local: uma reconexão do socket no meio dele não pode substituí-la.
  if (obterEstado().fonte.origem !== 'servidor') return;
  const salva = lerSessao();
  // A checagem aqui (e não só dentro de `lerCenarioDaUrl`) deixa o build de produção sem o cenário.
  const cenario = import.meta.env.DEV ? lerCenarioDaUrl() : null;
  if (!salva) {
    if (cenario) await abrirCenario(cenario);
    else atualizar({ retomando: false });
    return;
  }
  if (!obterEstado().sessao) atualizar({ retomando: true });
  try {
    const sessao = await requisitar<SessaoJogador>((r) =>
      socket.emit(
        'sala:reconectar',
        {
          codigoSala: salva.codigoSala,
          tokenSessao: salva.tokenSessao,
          dispositivoId: obterDispositivoId(),
        },
        r,
      ),
    );
    salvarSessao(sessao);
    atualizar({ sessao, retomando: false });
  } catch (erro) {
    // Em cenário de teste, sala perdida (servidor reiniciou pelo hot reload) é esperada: recria.
    if (cenario) {
      await abrirCenario(cenario);
      return;
    }
    tratarErro('sala:reconectar', erro);
    esquecerSessao();
  }
}

async function abrirCenario(cenario: CenarioDeTeste): Promise<void> {
  if (!obterEstado().sessao) atualizar({ retomando: true });
  if (!(await entrarNoCenario(cenario))) esquecerSessao();
}

export function cancelarRetomada(): void {
  esquecerSessao();
}

/** O servidor: cada ação vira um emit com ack, e os erros caem no tratamento único. */
export const acoesDoServidor: AcoesDaPartida = {
  async sair() {
    // Sai localmente mesmo se o servidor não confirmar: o usuário pediu para sair.
    await comando('sala:sair', (r) => socket.emit('sala:sair', r));
    esquecerSessao();
  },
  configurarSala: (configuracao) =>
    comando('sala:configurar', (r) => socket.emit('sala:configurar', { configuracao }, r)),
  definirMortosVeemCartas: (permitir) =>
    comando('sala:definirMortosVeemCartas', (r) =>
      socket.emit('sala:definirMortosVeemCartas', { permitir }, r),
    ),
  adicionarBot: () => comando('sala:adicionarBot', (r) => socket.emit('sala:adicionarBot', r)),
  expulsarParticipante: (participanteId) =>
    comando('sala:expulsar', (r) => socket.emit('sala:expulsar', { participanteId }, r)),
  iniciarPartida: () =>
    comando('sala:iniciarPartida', (r) => socket.emit('sala:iniciarPartida', r)),
  reiniciarSala: () => comando('sala:reiniciar', (r) => socket.emit('sala:reiniciar', r)),
  pausarPartida: () => comando('sala:pausar', (r) => socket.emit('sala:pausar', r)),
  retomarPartida: () => comando('sala:retomar', (r) => socket.emit('sala:retomar', r)),
  /**
   * A pausa de leitura é cortesia: se o servidor recusar (já usada nesta partida, outro lendo), o
   * resumo abre do mesmo jeito, sem pausar e sem aviso de erro.
   */
  async lerRegras() {
    try {
      await requisitar<null>((r) => socket.emit('jogo:lerRegras', r));
      return true;
    } catch (erro) {
      registrar('warn', 'leitura_das_regras.recusada', descreverErro(erro));
      return false;
    }
  },
  pararDeLerRegras: () =>
    comando('jogo:pararDeLerRegras', (r) => socket.emit('jogo:pararDeLerRegras', r)),
  palpitar: (quantidade) =>
    comando('jogo:palpitar', (r) => socket.emit('jogo:palpitar', { quantidade }, r)),
  jogarCarta: (cartaId) =>
    comando('jogo:jogarCarta', (r) => socket.emit('jogo:jogarCarta', { cartaId }, r)),
  votarEspera: (ausenteId, esperar) =>
    comando('jogo:votarEspera', (r) => socket.emit('jogo:votarEspera', { ausenteId, esperar }, r)),
  reagir: (reacao) => comando('jogo:reagir', (r) => socket.emit('jogo:reagir', { reacao }, r)),
};

/** A fonte ligada no armazém decide quem responde: a tela nunca sabe se é roteiro ou servidor. */
function acoes(): AcoesDaPartida {
  const { fonte } = obterEstado();
  return fonte.origem === 'servidor' ? acoesDoServidor : fonte.acoes;
}

export const sairDaSala = (): Promise<void> => acoes().sair();
export const configurarSala = (configuracao: ConfiguracaoPartida): Promise<boolean> =>
  acoes().configurarSala(configuracao);
export const definirMortosVeemCartas = (permitir: boolean): Promise<boolean> =>
  acoes().definirMortosVeemCartas(permitir);
export const adicionarBot = (): Promise<boolean> => acoes().adicionarBot();
export const expulsarParticipante = (participanteId: string): Promise<boolean> =>
  acoes().expulsarParticipante(participanteId);
export const iniciarPartida = (): Promise<boolean> => acoes().iniciarPartida();
export const reiniciarSala = (): Promise<boolean> => acoes().reiniciarSala();
export const pausarPartida = (): Promise<boolean> => acoes().pausarPartida();
export const retomarPartida = (): Promise<boolean> => acoes().retomarPartida();
export const lerRegras = (): Promise<boolean> => acoes().lerRegras();
export const pararDeLerRegras = (): Promise<boolean> => acoes().pararDeLerRegras();
export const palpitar = (quantidade: number): Promise<boolean> => acoes().palpitar(quantidade);
export const jogarCarta = (cartaId: string): Promise<boolean> => acoes().jogarCarta(cartaId);
export const votarEspera = (ausenteId: string, esperar: boolean): Promise<boolean> =>
  acoes().votarEspera(ausenteId, esperar);
export const reagir = (reacao: Reacao): Promise<boolean> => acoes().reagir(reacao);

export function voltarAoLobby(): void {
  atualizar({ voltouAoLobby: true });
}

export function dispensarAvisoDeEntrada(): void {
  atualizar({ avisoEntrada: null });
}

/** Liga os eventos do socket ao armazém e abre a conexão. Chamar uma única vez. */
export function iniciarConexao(): void {
  socket.on('connect', () => {
    atualizar({ conexao: 'conectado' });
    // Roda também nas reconexões automáticas: o servidor perde o vínculo do socket antigo.
    void retomarSessao();
  });
  socket.on('disconnect', () => atualizar({ conexao: 'desconectado' }));
  socket.on('connect_error', (erro) => {
    registrar('warn', 'socket.connect_error', descreverErro(erro));
    atualizar({ conexao: 'desconectado' });
  });
  socket.on('sala:estado', (sala) => receberDoServidor({ sala }));
  socket.on('jogo:estado', (jogo) => {
    const agora = Date.now();
    receberDoServidor((atual) => ({
      jogo,
      jogoRecebidoEm: agora,
      voltouAoLobby: jogo.fase === 'encerrada' ? atual.voltouAoLobby : false,
    }));
  });
  socket.on('jogo:reacao', registrarReacao);
  socket.on('sala:expulso', ({ mensagem }) => {
    // Fora do servidor (tutorial) não há sala de verdade de onde ser expulso.
    if (obterEstado().fonte.origem !== 'servidor') return;
    // O servidor já desvinculou este socket da sala: só falta limpar o que é local.
    esquecerSessao();
    atualizar({ avisoEntrada: mensagem });
  });
  socket.connect();
}

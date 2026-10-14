import type { ConfiguracaoPartida, SessaoJogador } from '@fodinha/shared';
import { descreverErro, registrar } from '../lib/log';
import { limparSessao, lerSessao, obterDispositivoId, salvarSessao } from '../lib/sessao';
import { ErroDeRequisicao, requisitar, socket, type Envio } from '../lib/socket';
import { atualizar, avisar, obterEstado } from './armazem';

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

function esquecerSessao(): void {
  limparSessao();
  atualizar({ sessao: null, sala: null, jogo: null, retomando: false, voltouAoLobby: false });
}

/** Tenta reentrar no assento guardado; qualquer falha devolve o usuário à tela inicial. */
export async function retomarSessao(): Promise<void> {
  const salva = lerSessao();
  if (!salva) {
    atualizar({ retomando: false });
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
    tratarErro('sala:reconectar', erro);
    esquecerSessao();
  }
}

export function cancelarRetomada(): void {
  esquecerSessao();
}

export async function sairDaSala(): Promise<void> {
  // Sai localmente mesmo se o servidor não confirmar: o usuário pediu para sair.
  await comando('sala:sair', (r) => socket.emit('sala:sair', r));
  esquecerSessao();
}

export function configurarSala(configuracao: ConfiguracaoPartida): Promise<boolean> {
  return comando('sala:configurar', (r) => socket.emit('sala:configurar', { configuracao }, r));
}

export function adicionarBot(): Promise<boolean> {
  return comando('sala:adicionarBot', (r) => socket.emit('sala:adicionarBot', r));
}

export function expulsarParticipante(participanteId: string): Promise<boolean> {
  return comando('sala:expulsar', (r) => socket.emit('sala:expulsar', { participanteId }, r));
}

export function iniciarPartida(): Promise<boolean> {
  return comando('sala:iniciarPartida', (r) => socket.emit('sala:iniciarPartida', r));
}

export function reiniciarSala(): Promise<boolean> {
  return comando('sala:reiniciar', (r) => socket.emit('sala:reiniciar', r));
}

export function pausarPartida(): Promise<boolean> {
  return comando('sala:pausar', (r) => socket.emit('sala:pausar', r));
}

export function retomarPartida(): Promise<boolean> {
  return comando('sala:retomar', (r) => socket.emit('sala:retomar', r));
}

export function palpitar(quantidade: number): Promise<boolean> {
  return comando('jogo:palpitar', (r) => socket.emit('jogo:palpitar', { quantidade }, r));
}

export function jogarCarta(cartaId: string): Promise<boolean> {
  return comando('jogo:jogarCarta', (r) => socket.emit('jogo:jogarCarta', { cartaId }, r));
}

export function votarEspera(ausenteId: string, esperar: boolean): Promise<boolean> {
  return comando('jogo:votarEspera', (r) =>
    socket.emit('jogo:votarEspera', { ausenteId, esperar }, r),
  );
}

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
  socket.on('sala:estado', (sala) => atualizar({ sala }));
  socket.on('jogo:estado', (jogo) => {
    const agora = Date.now();
    atualizar((atual) => ({
      jogo,
      jogoRecebidoEm: agora,
      voltouAoLobby: jogo.fase === 'encerrada' ? atual.voltouAoLobby : false,
    }));
  });
  socket.on('sala:expulso', ({ mensagem }) => {
    // O servidor já desvinculou este socket da sala: só falta limpar o que é local.
    esquecerSessao();
    atualizar({ avisoEntrada: mensagem });
  });
  socket.connect();
}

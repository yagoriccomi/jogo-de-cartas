import type { ConfiguracaoPartida, SessaoJogador } from '@fodinha/shared';
import { descreverErro, registrar } from '../lib/log';
import { limparSessao, lerSessao, salvarSessao } from '../lib/sessao';
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
    atualizar({ sessao, retomando: false });
    return true;
  } catch (erro) {
    tratarErro(operacao, erro);
    return false;
  }
}

export function criarSala(apelido: string, configuracao: ConfiguracaoPartida): Promise<boolean> {
  return obterSessao('sala:criar', (r) => socket.emit('sala:criar', { apelido, configuracao }, r));
}

export function entrarNaSala(codigoSala: string, apelido: string): Promise<boolean> {
  return obterSessao('sala:entrar', (r) => socket.emit('sala:entrar', { codigoSala, apelido }, r));
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
        { codigoSala: salva.codigoSala, tokenSessao: salva.tokenSessao },
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

export function removerParticipante(participanteId: string): Promise<boolean> {
  return comando('sala:removerParticipante', (r) =>
    socket.emit('sala:removerParticipante', { participanteId }, r),
  );
}

export function iniciarPartida(): Promise<boolean> {
  return comando('sala:iniciarPartida', (r) => socket.emit('sala:iniciarPartida', r));
}

export function palpitar(quantidade: number): Promise<boolean> {
  return comando('jogo:palpitar', (r) => socket.emit('jogo:palpitar', { quantidade }, r));
}

export function jogarCarta(cartaId: string): Promise<boolean> {
  return comando('jogo:jogarCarta', (r) => socket.emit('jogo:jogarCarta', { cartaId }, r));
}

export function voltarAoLobby(): void {
  atualizar({ voltouAoLobby: true });
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
  socket.on('jogo:estado', (jogo) =>
    atualizar((atual) => ({
      jogo,
      voltouAoLobby: jogo.fase === 'encerrada' ? atual.voltouAoLobby : false,
    })),
  );
  socket.connect();
}

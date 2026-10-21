import { REACOES, type CodigoErro, type ConfiguracaoPartida, type Reacao } from '@fodinha/shared';
import { validarConfiguracao, validarMortosVeemCartas } from '../../domain/configuracao';
import { ErroDeRegra } from '../../domain/erros';

/**
 * Converte o `unknown` que chega pelo socket nos tipos dos casos de uso. Aqui só se confere o
 * formato (tipo de cada campo); faixas e regras (tamanho do apelido, vidas, palpite permitido)
 * continuam na aplicação e no domínio, que não confiam em quem os chama.
 */

export interface Identificacao {
  readonly apelido: string;
  readonly dispositivoId: string;
}

export function lerCriacao(dados: unknown): Identificacao & {
  readonly configuracao: ConfiguracaoPartida;
} {
  const corpo = objeto(dados);
  return { ...identificacao(corpo), configuracao: validarConfiguracao(corpo.configuracao) };
}

export function lerCenario(dados: unknown): Identificacao & {
  readonly jogadores: number;
  readonly cartas: number;
} {
  const corpo = objeto(dados);
  const mensagem = 'Cenário inválido: informe jogadores e cartas.';
  return {
    ...identificacao(corpo),
    jogadores: numero(corpo.jogadores, mensagem),
    cartas: numero(corpo.cartas, mensagem),
  };
}

export function lerEntrada(dados: unknown): Identificacao & { readonly codigoSala: string } {
  const corpo = objeto(dados);
  return { ...identificacao(corpo), codigoSala: codigoSala(corpo) };
}

export function lerReconexao(dados: unknown): {
  readonly codigoSala: string;
  readonly tokenSessao: string;
  readonly dispositivoId: string;
} {
  const corpo = objeto(dados);
  return {
    dispositivoId: dispositivo(corpo),
    codigoSala: codigoSala(corpo),
    // Token que não é texto é uma sessão perdida, não um erro de digitação: o cliente refaz a entrada.
    tokenSessao: texto(
      corpo.tokenSessao,
      'Sessão expirada. Entre na sala novamente.',
      'SEM_PERMISSAO',
    ),
  };
}

export function lerConfiguracao(dados: unknown): ConfiguracaoPartida {
  return validarConfiguracao(objeto(dados).configuracao);
}

export function lerMortosVeemCartas(dados: unknown): boolean {
  return validarMortosVeemCartas(objeto(dados).permitir);
}

export function lerExpulsao(dados: unknown): string {
  return texto(objeto(dados).participanteId, 'Participante inválido.');
}

export function lerVoto(dados: unknown): { readonly ausenteId: string; readonly esperar: boolean } {
  const { ausenteId, esperar } = objeto(dados);
  if (typeof ausenteId !== 'string' || typeof esperar !== 'boolean') {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Voto inválido.');
  }
  return { ausenteId, esperar };
}

export function lerPalpite(dados: unknown): number {
  return numero(objeto(dados).quantidade, 'Palpite inválido.', 'PALPITE_INVALIDO');
}

export function lerCarta(dados: unknown): string {
  return texto(objeto(dados).cartaId, 'Carta inválida.', 'JOGADA_INVALIDA');
}

export function lerReacao(dados: unknown): Reacao {
  const { reacao } = objeto(dados);
  if (!REACOES.includes(reacao as Reacao)) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Reação inválida.');
  }
  return reacao as Reacao;
}

function objeto(dados: unknown): Record<string, unknown> {
  if (typeof dados !== 'object' || dados === null) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Dados da requisição inválidos.');
  }
  return dados as Record<string, unknown>;
}

function identificacao(corpo: Record<string, unknown>): Identificacao {
  return {
    apelido: texto(corpo.apelido, 'Informe um apelido.'),
    dispositivoId: dispositivo(corpo),
  };
}

function dispositivo(corpo: Record<string, unknown>): string {
  return texto(corpo.dispositivoId, 'Identificação do navegador ausente ou inválida.');
}

function codigoSala(corpo: Record<string, unknown>): string {
  return texto(corpo.codigoSala, 'Informe o código da sala.');
}

function texto(valor: unknown, mensagem: string, codigo: CodigoErro = 'ENTRADA_INVALIDA'): string {
  if (typeof valor !== 'string') throw new ErroDeRegra(codigo, mensagem);
  return valor;
}

function numero(valor: unknown, mensagem: string, codigo: CodigoErro = 'ENTRADA_INVALIDA'): number {
  if (typeof valor !== 'number') throw new ErroDeRegra(codigo, mensagem);
  return valor;
}

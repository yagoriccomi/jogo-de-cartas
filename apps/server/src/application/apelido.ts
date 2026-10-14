import { LIMITES } from '@fodinha/shared';
import { ErroDeRegra } from '../domain/erros';

const CARACTERES_DE_CONTROLE = /[\p{Cc}\p{Cf}]/gu;

export function normalizarApelido(texto: unknown): string {
  if (typeof texto !== 'string') {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Informe um apelido.');
  }
  const apelido = texto.replace(CARACTERES_DE_CONTROLE, '').replace(/\s+/g, ' ').trim();
  if (apelido.length === 0 || apelido.length > LIMITES.maxApelido) {
    throw new ErroDeRegra(
      'ENTRADA_INVALIDA',
      `O apelido deve ter entre 1 e ${LIMITES.maxApelido} caracteres.`,
    );
  }
  return apelido;
}

/** Identificador aleatório do navegador; só precisa ser um texto curto e não vazio. */
export function normalizarDispositivo(texto: unknown): string {
  if (
    typeof texto !== 'string' ||
    texto.trim().length === 0 ||
    texto.length > LIMITES.maxIdentificador
  ) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Identificação do navegador ausente ou inválida.');
  }
  return texto.trim();
}

export function normalizarCodigoSala(texto: unknown): string {
  if (typeof texto !== 'string' || texto.trim().length === 0) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Informe o código da sala.');
  }
  return texto.trim().toUpperCase();
}

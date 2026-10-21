import { LIMITES } from '@fodinha/shared';
import { ErroDeRegra } from '../domain/erros';

const CARACTERES_DE_CONTROLE = /[\p{Cc}\p{Cf}]/gu;

export function normalizarApelido(texto: string): string {
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
export function normalizarDispositivo(texto: string): string {
  if (texto.trim().length === 0 || texto.length > LIMITES.maxIdentificador) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Identificação do navegador ausente ou inválida.');
  }
  return texto.trim();
}

export function normalizarCodigoSala(texto: string): string {
  if (texto.trim().length === 0) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Informe o código da sala.');
  }
  return texto.trim().toUpperCase();
}

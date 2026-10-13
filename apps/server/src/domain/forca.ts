import { NAIPES, type Carta, type Valor } from '@fodinha/shared';

/** A manilha é o valor seguinte ao da vira, de forma cíclica (depois do 3 vem o 4). */
export function valorDaManilha(vira: Valor, valores: readonly Valor[]): Valor {
  const posicao = valores.indexOf(vira);
  return valores[(posicao + 1) % valores.length] as Valor;
}

/**
 * Força comparável de uma carta. Cartas comuns valem pela posição do valor
 * (o naipe não desempata — é isso que permite a anulação entre cartas iguais).
 * Manilhas ficam acima de tudo e se ordenam por naipe: ouros < espadas < copas < paus.
 */
export function forcaDaCarta(carta: Carta, manilha: Valor, valores: readonly Valor[]): number {
  if (carta.valor === manilha) return valores.length + NAIPES.indexOf(carta.naipe);
  return valores.indexOf(carta.valor);
}

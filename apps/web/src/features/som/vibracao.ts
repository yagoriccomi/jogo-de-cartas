import type { EventoDaMesa } from './eventos';

/** Padrões em ms (vibra, pausa, vibra...). `navigator.vibrate` não existe no iOS nem no desktop. */
const PADROES: Partial<Record<EventoDaMesa, readonly number[]>> = {
  minhaVez: [40, 60, 40],
  perdiVida: [250, 80, 250],
};

export function vibrarPara(evento: EventoDaMesa): void {
  const padrao = PADROES[evento];
  if (padrao === undefined || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate([...padrao]);
}

import type { Carta, Naipe, Valor } from '@fodinha/shared';
import type { GeradorAleatorio } from '../src/domain/aleatoriedade';

/** Gerador determinístico (mulberry32) para partidas reproduzíveis nos testes. */
export function geradorComSemente(semente: number): GeradorAleatorio {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let sequencial = 0;
export function carta(valor: Valor, naipe: Naipe): Carta {
  sequencial += 1;
  return { id: `t${sequencial}`, valor, naipe };
}

import { useEffect, useState } from 'react';

/** Relógio reativo para contagens regressivas; só roda enquanto o componente está montado. */
export function useAgora(intervaloMs = 250): number {
  const [agora, definirAgora] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => definirAgora(Date.now()), intervaloMs);
    return () => clearInterval(id);
  }, [intervaloMs]);
  return agora;
}

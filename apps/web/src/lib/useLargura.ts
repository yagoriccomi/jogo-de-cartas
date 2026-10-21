import { useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Mede a largura de um elemento e acompanha redimensionamentos (necessário para calcular o leque). */
export function useLargura<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const referencia = useRef<T>(null);
  const [largura, definirLargura] = useState(0);

  useLayoutEffect(() => {
    const elemento = referencia.current;
    if (!elemento) return;
    definirLargura(elemento.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => definirLargura(elemento.clientWidth));
    observador.observe(elemento);
    return () => observador.disconnect();
  }, []);

  return [referencia, largura];
}

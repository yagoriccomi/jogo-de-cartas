/** Ponteiro grosso (dedo) toca; mouse clica. O tutorial fala o verbo do aparelho em uso. */
export function usaToque(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
}

export function verboDeToque(): 'Toque' | 'Clique' {
  return usaToque() ? 'Toque' : 'Clique';
}

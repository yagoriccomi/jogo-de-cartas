import { describe, expect, it } from 'vitest';
import { emOrdemDeJogo } from '../../../src/features/mesa/ordemDeJogo';

const assento = (id: string, eliminado = false) => ({ id, eliminado });
const ids = (lista: readonly { id: string }[]) => lista.map((j) => j.id);

describe('emOrdemDeJogo', () => {
  const mesa = [assento('a'), assento('b'), assento('c'), assento('d')];

  it('deveComecarPelaMaoETerminarNoPe', () => {
    expect(ids(emOrdemDeJogo(mesa, 'c', 'b'))).toEqual(['c', 'd', 'a', 'b']);
  });

  it('deveComecarDepoisDoPeQuandoNaoHaMao', () => {
    expect(ids(emOrdemDeJogo(mesa, null, 'd'))).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(emOrdemDeJogo(mesa, null, 'a'))).toEqual(['b', 'c', 'd', 'a']);
  });

  it('deveManterAOrdemDosAssentosSemMaoNemPe', () => {
    expect(ids(emOrdemDeJogo(mesa, null, null))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('deveMandarOsEliminadosParaOFimNaOrdemDeJogo', () => {
    const comEliminados = [assento('a'), assento('b', true), assento('c'), assento('d', true)];
    expect(ids(emOrdemDeJogo(comEliminados, 'c', 'a'))).toEqual(['c', 'a', 'd', 'b']);
  });

  it('deveIgnorarIdsQueNaoEstaoNaMesa', () => {
    expect(ids(emOrdemDeJogo(mesa, 'x', 'y'))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('naoDeveAlterarAListaRecebida', () => {
    const copia = [...mesa];
    emOrdemDeJogo(mesa, 'c', 'b');
    expect(mesa).toEqual(copia);
  });
});

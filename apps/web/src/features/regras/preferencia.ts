import { declararMarcaDoAparelho } from '../../lib/preferencia';

// Sem armazenamento o resumo só volta a aparecer na próxima partida: nada se perde.
const resumo = declararMarcaDoAparelho('fodinha:resumo-das-regras', 'dispensado');

export const resumoDispensado = resumo.obter;

export function dispensarResumo(): void {
  resumo.definir(true);
}

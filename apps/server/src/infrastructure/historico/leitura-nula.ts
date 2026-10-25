import type { LeituraDoHistorico } from '../../application/portas';

/** Sem banco: as rotas respondem `desligado` e o web esconde "Minhas partidas". */
export class LeituraDoHistoricoNula implements LeituraDoHistorico {
  readonly ligada = false;

  async partidasDaConta(): Promise<[]> {
    return [];
  }

  async partidaParaRever(): Promise<null> {
    return null;
  }

  async rodadasAte(): Promise<[]> {
    return [];
  }
}

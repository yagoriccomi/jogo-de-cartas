import type {
  FimDaPartida,
  InicioDaPartida,
  RegistroDePartidas,
  RodadaParaGravar,
} from '../../application/portas';

export interface PartidaNaMemoria {
  readonly inicio: InicioDaPartida;
  readonly rodadas: RodadaParaGravar[];
  fim: FimDaPartida | null;
}

/** Para os testes de aplicação: guarda o que chegaria ao banco, na ordem em que chegou. */
export class RegistroDePartidasEmMemoria implements RegistroDePartidas {
  readonly partidas = new Map<string, PartidaNaMemoria>();

  async iniciarPartida(inicio: InicioDaPartida): Promise<void> {
    this.partidas.set(inicio.idPartida, { inicio, rodadas: [], fim: null });
  }

  async gravarRodada(rodada: RodadaParaGravar): Promise<void> {
    this.exigir(rodada.idPartida).rodadas.push(rodada);
  }

  async encerrarPartida(fim: FimDaPartida): Promise<void> {
    this.exigir(fim.idPartida).fim = fim;
  }

  /** Como o banco, que recusa a rodada de uma partida que não existe. */
  private exigir(idPartida: string): PartidaNaMemoria {
    const partida = this.partidas.get(idPartida);
    if (!partida) throw new Error(`Partida ${idPartida} não foi iniciada no registro.`);
    return partida;
  }
}

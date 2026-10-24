import type { RegistroDePartidas } from '../../application/portas';

/** Sem `TURSO_DATABASE_URL`: o jogo roda igual e nada é gravado. */
export class RegistroDePartidasNulo implements RegistroDePartidas {
  async iniciarPartida(): Promise<void> {}

  async gravarRodada(): Promise<void> {}

  async encerrarPartida(): Promise<void> {}
}

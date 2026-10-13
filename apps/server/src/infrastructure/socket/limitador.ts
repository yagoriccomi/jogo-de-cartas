const JANELA_MS = 5_000;
const MAXIMO_POR_JANELA = 40;

/** Janela fixa por socket: barra flood de eventos sem atrapalhar quem joga normalmente. */
export class LimitadorDeEventos {
  private readonly janelas = new Map<string, { inicio: number; contagem: number }>();

  constructor(private readonly agora: () => number = Date.now) {}

  permitir(socketId: string): boolean {
    const instante = this.agora();
    const janela = this.janelas.get(socketId);
    if (!janela || instante - janela.inicio >= JANELA_MS) {
      this.janelas.set(socketId, { inicio: instante, contagem: 1 });
      return true;
    }
    janela.contagem += 1;
    return janela.contagem <= MAXIMO_POR_JANELA;
  }

  esquecer(socketId: string): void {
    this.janelas.delete(socketId);
  }
}

/**
 * localStorage em memória para os módulos que leem preferências ao carregar. Sem ele, cada
 * leitura cairia no caminho de erro (que o app trata) e encheria a saída de avisos.
 */
class ArmazenamentoEmMemoria implements Storage {
  private readonly dados = new Map<string, string>();

  get length(): number {
    return this.dados.size;
  }

  clear(): void {
    this.dados.clear();
  }

  getItem(chave: string): string | null {
    return this.dados.get(chave) ?? null;
  }

  key(indice: number): string | null {
    return [...this.dados.keys()][indice] ?? null;
  }

  removeItem(chave: string): void {
    this.dados.delete(chave);
  }

  setItem(chave: string, valor: string): void {
    this.dados.set(chave, String(valor));
  }
}

globalThis.localStorage = new ArmazenamentoEmMemoria();

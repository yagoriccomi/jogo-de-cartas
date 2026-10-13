import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { GeradorDeIdentificadores, Relogio, RepositorioDeSalas } from '../application/portas';
import type { Sala } from '../domain/sala';

/** Instância única na Render (premissa P12). Para escalar, trocar por uma implementação em Redis. */
export class RepositorioDeSalasEmMemoria implements RepositorioDeSalas {
  private readonly salas = new Map<string, Sala>();

  buscar(codigo: string): Sala | undefined {
    return this.salas.get(codigo);
  }

  salvar(sala: Sala): void {
    this.salas.set(sala.codigo, sala);
  }

  remover(codigo: string): void {
    this.salas.delete(codigo);
  }

  existe(codigo: string): boolean {
    return this.salas.has(codigo);
  }

  get quantidade(): number {
    return this.salas.size;
  }
}

export class RelogioDoSistema implements Relogio {
  agora(): number {
    return Date.now();
  }

  agendar(atrasoMs: number, acao: () => void): () => void {
    const temporizador = setTimeout(acao, atrasoMs);
    return () => clearTimeout(temporizador);
  }
}

// Sem 0/O, 1/I/L: o código é ditado em voz alta entre amigos.
const ALFABETO_DO_CODIGO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const TAMANHO_DO_CODIGO = 5;

export class IdentificadoresCriptograficos implements GeradorDeIdentificadores {
  novoId(): string {
    return randomUUID();
  }

  novoToken(): string {
    return randomBytes(32).toString('base64url');
  }

  novoCodigoSala(): string {
    return Array.from(
      { length: TAMANHO_DO_CODIGO },
      () => ALFABETO_DO_CODIGO[randomInt(ALFABETO_DO_CODIGO.length)],
    ).join('');
  }
}

/** Embaralhamento com gerador criptográfico: ninguém consegue prever a distribuição. */
export function aleatorioCriptografico(): number {
  return randomBytes(6).readUIntBE(0, 6) / 2 ** 48;
}

import { useSyncExternalStore } from 'react';
import { descreverErro, registrar } from './log';

/** Como uma preferência vira texto no localStorage e volta dele. */
export interface DeclaracaoDePreferencia<T> {
  readonly chave: string;
  /** Vale quando não há nada gravado, o gravado é inválido ou o armazenamento falha. */
  readonly padrao: T;
  /** Texto gravado → valor; `null` quando o texto não é um valor válido. */
  readonly decodificar: (bruto: string) => T | null;
  /** Valor → texto a gravar; `null` apaga a chave (e a leitura volta ao padrão). */
  readonly codificar: (valor: T) => string | null;
  /** Conteúdo inválido sai do armazenamento, para não repetir o erro a cada abertura. */
  readonly apagarSeInvalido?: boolean;
}

export interface Preferencia<T> {
  readonly obter: () => T;
  readonly definir: (valor: T) => void;
  /** Assinatura fora do React (ex.: a música); devolve o cancelamento. */
  readonly assinar: (ouvinte: () => void) => () => void;
}

const FALHOU = Symbol('armazenamento-falhou');
type Leitura = string | null | typeof FALHOU;

// Em modo privado cada leitura/escrita falharia de novo (um arrasto de volume são dezenas):
// basta um aviso por chave para o diagnóstico.
const falhasJaAvisadas = new Set<string>();

function avisarFalha(evento: string, chave: string, erro: unknown): void {
  const marca = `${evento}:${chave}`;
  if (falhasJaAvisadas.has(marca)) return;
  falhasJaAvisadas.add(marca);
  registrar('warn', evento, { chave, ...descreverErro(erro) });
}

// O localStorage pode lançar (modo privado, dados bloqueados): o app precisa funcionar sem ele.
function lerDoArmazenamento(chave: string): Leitura {
  try {
    return localStorage.getItem(chave);
  } catch (erro) {
    avisarFalha('storage.leitura_falhou', chave, erro);
    return FALHOU;
  }
}

function gravarNoArmazenamento(chave: string, bruto: string | null): boolean {
  try {
    if (bruto === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, bruto);
    return true;
  } catch (erro) {
    avisarFalha('storage.escrita_falhou', chave, erro);
    return false;
  }
}

interface Lembranca<T> {
  readonly bruto: string | null;
  readonly valor: T;
}

/**
 * Declare uma vez por chave, no nível do módulo: quem usa a mesma declaração vê o mesmo valor
 * e é avisado das mudanças. Sem armazenamento, o valor vive na memória até recarregar a página.
 */
export function declararPreferencia<T>(declaracao: DeclaracaoDePreferencia<T>): Preferencia<T> {
  const { chave, padrao } = declaracao;
  const ouvintes = new Set<() => void>();
  let lembrado: Lembranca<T> | null = null;
  // Escrita recusada (ex.: Safari privado lê mas não grava): o armazenamento ficou para trás.
  let soNaMemoria = false;

  function decodificar(bruto: string | null): T {
    if (bruto === null) return padrao;
    return declaracao.decodificar(bruto) ?? padrao;
  }

  function obter(): T {
    if (soNaMemoria && lembrado !== null) return lembrado.valor;
    const bruto = lerDoArmazenamento(chave);
    if (bruto === FALHOU) return lembrado?.valor ?? padrao;
    // Mesmo texto, mesmo objeto: o useSyncExternalStore exige leitura estável.
    if (lembrado !== null && lembrado.bruto === bruto) return lembrado.valor;
    const decodificado = bruto === null ? null : declaracao.decodificar(bruto);
    const invalido = bruto !== null && decodificado === null;
    if (invalido && declaracao.apagarSeInvalido === true) {
      gravarNoArmazenamento(chave, null);
      lembrado = { bruto: null, valor: padrao };
      return padrao;
    }
    lembrado = { bruto, valor: decodificado ?? padrao };
    return lembrado.valor;
  }

  function definir(valor: T): void {
    const bruto = declaracao.codificar(valor);
    // Na memória fica o que uma releitura daria: o valor já normalizado pela própria declaração.
    lembrado = { bruto, valor: decodificar(bruto) };
    soNaMemoria = !gravarNoArmazenamento(chave, bruto);
    ouvintes.forEach((ouvinte) => ouvinte());
  }

  function assinar(ouvinte: () => void): () => void {
    ouvintes.add(ouvinte);
    return () => ouvintes.delete(ouvinte);
  }

  return { obter, definir, assinar };
}

/** Algo feito uma vez por aparelho (ex.: "não perguntar novamente"): marcado ou não. */
export function declararMarcaDoAparelho(chave: string, valorMarcado: string): Preferencia<boolean> {
  return declararPreferencia({
    chave,
    padrao: false,
    decodificar: (bruto) => (bruto === valorMarcado ? true : null),
    codificar: (marcado) => (marcado ? valorMarcado : null),
  });
}

export function usePreferencia<T>(preferencia: Preferencia<T>): T {
  return useSyncExternalStore(preferencia.assinar, preferencia.obter);
}

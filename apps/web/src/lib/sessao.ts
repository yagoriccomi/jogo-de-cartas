import type { SessaoJogador } from '@fodinha/shared';
import { registrar, descreverErro } from './log';

const CHAVE_SESSAO = 'fodinha:sessao';
const CHAVE_APELIDO = 'fodinha:apelido';

// O localStorage pode lançar (modo privado, dados bloqueados): o app precisa funcionar sem ele.
function ler(chave: string): string | null {
  try {
    return localStorage.getItem(chave);
  } catch (erro) {
    registrar('warn', 'storage.leitura_falhou', { chave, ...descreverErro(erro) });
    return null;
  }
}

function gravar(chave: string, valor: string | null): void {
  try {
    if (valor === null) localStorage.removeItem(chave);
    else localStorage.setItem(chave, valor);
  } catch (erro) {
    registrar('warn', 'storage.escrita_falhou', { chave, ...descreverErro(erro) });
  }
}

function ehSessao(valor: unknown): valor is SessaoJogador {
  if (typeof valor !== 'object' || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.codigoSala === 'string' &&
    typeof v.jogadorId === 'string' &&
    typeof v.tokenSessao === 'string'
  );
}

export function lerSessao(): SessaoJogador | null {
  const bruto = ler(CHAVE_SESSAO);
  if (bruto === null) return null;
  try {
    const dados: unknown = JSON.parse(bruto);
    return ehSessao(dados) ? dados : null;
  } catch {
    // Conteúdo corrompido equivale a "sem sessão"; limpar evita repetir o erro a cada abertura.
    gravar(CHAVE_SESSAO, null);
    return null;
  }
}

export function salvarSessao(sessao: SessaoJogador): void {
  gravar(CHAVE_SESSAO, JSON.stringify(sessao));
}

export function limparSessao(): void {
  gravar(CHAVE_SESSAO, null);
}

export function lerApelido(): string {
  return ler(CHAVE_APELIDO) ?? '';
}

export function salvarApelido(apelido: string): void {
  gravar(CHAVE_APELIDO, apelido);
}

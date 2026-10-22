import { LIMITES, type SessaoJogador } from '@fodinha/shared';
import { declararPreferencia } from './preferencia';

function ehSessao(valor: unknown): valor is SessaoJogador {
  if (typeof valor !== 'object' || valor === null) return false;
  const v = valor as Record<string, unknown>;
  return (
    typeof v.codigoSala === 'string' &&
    typeof v.jogadorId === 'string' &&
    typeof v.tokenSessao === 'string'
  );
}

function decodificarSessao(bruto: string): SessaoJogador | null {
  try {
    const dados: unknown = JSON.parse(bruto);
    return ehSessao(dados) ? dados : null;
  } catch {
    return null;
  }
}

const sessao = declararPreferencia<SessaoJogador | null>({
  chave: 'fodinha:sessao',
  padrao: null,
  decodificar: decodificarSessao,
  codificar: (valor) => (valor === null ? null : JSON.stringify(valor)),
  // Conteúdo corrompido equivale a "sem sessão".
  apagarSeInvalido: true,
});

const apelido = declararPreferencia<string>({
  chave: 'fodinha:apelido',
  padrao: '',
  decodificar: (bruto) => bruto,
  codificar: (valor) => valor,
});

export const lerSessao = sessao.obter;

export function salvarSessao(valor: SessaoJogador): void {
  sessao.definir(valor);
}

export function limparSessao(): void {
  sessao.definir(null);
}

export const lerApelido = apelido.obter;
export const salvarApelido = apelido.definir;

const BYTES_DO_IDENTIFICADOR = 16;
const BASE_HEXADECIMAL = 16;

function gerarIdentificador(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // `randomUUID` só existe em contexto seguro (HTTPS/localhost); em http na rede local cai aqui.
  const bytes = crypto.getRandomValues(new Uint8Array(BYTES_DO_IDENTIFICADOR));
  return Array.from(bytes, (byte) => byte.toString(BASE_HEXADECIMAL).padStart(2, '0')).join('');
}

const dispositivo = declararPreferencia<string | null>({
  chave: 'fodinha:dispositivo',
  padrao: null,
  decodificar: (bruto) =>
    bruto.length > 0 && bruto.length <= LIMITES.maxIdentificador ? bruto : null,
  codificar: (valor) => valor,
});

/**
 * Identificador estável deste navegador: o servidor o usa para barrar quem foi expulso.
 * Se o armazenamento falhar, vale o da memória (estável até recarregar a página).
 */
export function obterDispositivoId(): string {
  const salvo = dispositivo.obter();
  if (salvo !== null) return salvo;
  const novo = gerarIdentificador();
  dispositivo.definir(novo);
  return novo;
}

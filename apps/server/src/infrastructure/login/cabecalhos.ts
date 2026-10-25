import type { IncomingHttpHeaders } from 'node:http';
import { LIMITES } from '@fodinha/shared';

const ESQUEMA_BEARER = /^Bearer\s+(\S+)$/i;

/** Cabeçalhos do Node → `Headers` da Fetch API, que é o que o Better Auth lê. */
export function cabecalhosDe(cabecalhos: IncomingHttpHeaders): Headers {
  const convertidos = new Headers();
  for (const [nome, valor] of Object.entries(cabecalhos)) {
    if (valor === undefined) continue;
    for (const item of Array.isArray(valor) ? valor : [valor]) convertidos.append(nome, item);
  }
  return convertidos;
}

export function cabecalhoBearer(token: string): Headers {
  return new Headers({ authorization: `Bearer ${token}` });
}

/** Token do cabeçalho `Authorization: Bearer`; ausente, malformado ou grande demais = `null`. */
export function tokenDoCabecalho(autorizacao: string | undefined): string | null {
  const token = ESQUEMA_BEARER.exec(autorizacao ?? '')?.[1];
  return token !== undefined && token.length <= LIMITES.maxTokenDeLogin ? token : null;
}

/** Texto curto ou `null`: o que vem de fora (query, corpo, aperto de mão) chega como `unknown`. */
export function textoLimitado(valor: unknown, maximo: number): string | null {
  return typeof valor === 'string' && valor.length > 0 && valor.length <= maximo ? valor : null;
}

/**
 * Para onde a volta do login pode mandar: só as origens de `CORS_ORIGINS`, e só a origem pura
 * (sem caminho). Barra o redirecionamento aberto ("entre com Google e caia num site qualquer").
 */
export function origemDoWeb(valor: unknown, origensDoWeb: readonly string[]): string | null {
  if (typeof valor !== 'string' || !URL.canParse(valor)) return null;
  const origem = new URL(valor).origin;
  return origem === valor && origensDoWeb.includes(origem) ? origem : null;
}

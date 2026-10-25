import { ENDERECOS_DO_LOGIN, LIMITES } from '@fodinha/shared';

export type RetornoDoLogin =
  { readonly tipo: 'codigo'; readonly codigo: string } | { readonly tipo: 'falha' } | null;

/**
 * Lê a volta do Google no fragmento do endereço (`#login=<código>` ou `#login-falhou`). O código
 * viaja no fragmento porque ele não vai a servidor nenhum (nem aos logs da hospedagem do web).
 */
export function lerRetornoDoLogin(fragmento: string): RetornoDoLogin {
  const conteudo = fragmento.startsWith('#') ? fragmento.slice(1) : fragmento;
  if (conteudo === ENDERECOS_DO_LOGIN.falha) return { tipo: 'falha' };
  const parametros = new URLSearchParams(conteudo);
  const codigo = parametros.get(ENDERECOS_DO_LOGIN.codigo);
  if (codigo === null) return null;
  if (codigo === '' || codigo.length > LIMITES.maxTokenDeLogin) return { tipo: 'falha' };
  return { tipo: 'codigo', codigo };
}

import { LIMITES } from '@fodinha/shared';
import { declararPreferencia } from './preferencia';

/**
 * Token da sessão de login (Google). Fica no aparelho porque o web e o servidor estão em domínios
 * diferentes: um cookie do servidor seria de terceiros, e o Safari o bloqueia.
 */
const token = declararPreferencia<string | null>({
  chave: 'fodinha:login',
  padrao: null,
  decodificar: (bruto) =>
    bruto.length > 0 && bruto.length <= LIMITES.maxTokenDeLogin ? bruto : null,
  codificar: (valor) => valor,
  apagarSeInvalido: true,
});

export const lerTokenDeLogin = token.obter;
export const salvarTokenDeLogin = (valor: string): void => token.definir(valor);
export const esquecerTokenDeLogin = (): void => token.definir(null);

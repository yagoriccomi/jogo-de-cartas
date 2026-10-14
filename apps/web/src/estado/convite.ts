import {
  compartilharConvite,
  copiarConvite,
  montarLinkDeConvite,
  podeCompartilhar,
} from '../lib/convite';
import { avisar } from './armazem';

export async function copiarConviteComAviso(codigo: string): Promise<void> {
  const resultado = await copiarConvite(codigo);
  if (resultado === 'copiado') {
    avisar('sucesso', 'Link de convite copiado!');
    return;
  }
  // Sem permissão de área de transferência: mostra o link para o usuário copiar à mão.
  avisar('info', `Copie o link: ${montarLinkDeConvite(codigo)}`);
}

export async function compartilharConviteComAviso(codigo: string): Promise<void> {
  const resultado = await compartilharConvite(codigo);
  if (resultado === 'falhou') await copiarConviteComAviso(codigo);
}

/** "Convidar": usa a folha de compartilhamento do aparelho quando existe e copia o link quando não. */
export function convidar(codigo: string): Promise<void> {
  return podeCompartilhar() ? compartilharConviteComAviso(codigo) : copiarConviteComAviso(codigo);
}

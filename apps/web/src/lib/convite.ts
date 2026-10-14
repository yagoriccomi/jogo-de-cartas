import { descreverErro, registrar } from './log';

export type ResultadoConvite = 'compartilhado' | 'copiado' | 'cancelado' | 'falhou';

export function montarLinkDeConvite(codigo: string): string {
  return `${window.location.origin}/?sala=${encodeURIComponent(codigo)}`;
}

/** A mensagem já leva o link: o WhatsApp e a folha nativa mostram só o texto. */
export function montarMensagemDeConvite(codigo: string): string {
  return `Bora jogar Fodinha? 🃏 Entra na minha sala: ${montarLinkDeConvite(codigo)}`;
}

export function montarLinkWhatsApp(codigo: string): string {
  return `https://wa.me/?text=${encodeURIComponent(montarMensagemDeConvite(codigo))}`;
}

export function podeCompartilhar(): boolean {
  return typeof navigator.share === 'function';
}

export async function copiarConvite(codigo: string): Promise<ResultadoConvite> {
  try {
    await navigator.clipboard.writeText(montarLinkDeConvite(codigo));
    return 'copiado';
  } catch (erro) {
    registrar('warn', 'convite.copiar_falhou', descreverErro(erro));
    return 'falhou';
  }
}

export async function compartilharConvite(codigo: string): Promise<ResultadoConvite> {
  try {
    await navigator.share({
      title: 'Fodinha',
      text: montarMensagemDeConvite(codigo),
    });
    return 'compartilhado';
  } catch (erro) {
    // Fechar a folha de compartilhamento não é erro: o usuário só desistiu.
    if (erro instanceof DOMException && erro.name === 'AbortError') return 'cancelado';
    registrar('warn', 'convite.compartilhar_falhou', descreverErro(erro));
    return 'falhou';
  }
}

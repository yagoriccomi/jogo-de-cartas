import { montarLinkWhatsApp } from '../lib/convite';
import { IconeWhatsApp } from './Icones';

/** Abre o WhatsApp (app ou web) com o convite pronto; é link, não botão, para abrir em nova aba. */
export function BotaoWhatsApp({ codigo }: { readonly codigo: string }) {
  return (
    <a
      className="botao botao--whatsapp"
      href={montarLinkWhatsApp(codigo)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Convidar pelo WhatsApp (abre em nova aba)"
    >
      <IconeWhatsApp className="icone" />
      WhatsApp
    </a>
  );
}

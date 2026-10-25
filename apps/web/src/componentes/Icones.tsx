import type { ReactNode } from 'react';

interface Props {
  readonly className?: string;
}

/** Ícones de traço (24x24) herdando a cor do texto; sempre decorativos (`aria-hidden`). */
function Icone({ className = 'icone', children }: Props & { readonly children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconeMenu = (p: Props) => (
  <Icone {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Icone>
);

export const IconeFechar = (p: Props) => (
  <Icone {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icone>
);

export const IconeLink = (p: Props) => (
  <Icone {...p}>
    <path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1" />
  </Icone>
);

export const IconeOlho = (p: Props) => (
  <Icone {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
);

export const IconeLivro = (p: Props) => (
  <Icone {...p}>
    <path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" />
    <path d="M4 19V5" />
  </Icone>
);

export const IconeReiniciar = (p: Props) => (
  <Icone {...p}>
    <path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8" />
    <path d="M3 3v5h5" />
  </Icone>
);

export const IconePausar = (p: Props) => (
  <Icone {...p}>
    <path d="M8 5v14M16 5v14" />
  </Icone>
);

export const IconeRetomar = (p: Props) => (
  <Icone {...p}>
    <path d="M7 4l13 8-13 8z" />
  </Icone>
);

export const IconeExpulsar = (p: Props) => (
  <Icone {...p}>
    <circle cx="9" cy="8" r="4" />
    <path d="M2 21a7 7 0 0114 0M17 8l4 4M21 8l-4 4" />
  </Icone>
);

export const IconeSair = (p: Props) => (
  <Icone {...p}>
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" />
  </Icone>
);

export const IconeInstalar = (p: Props) => (
  <Icone {...p}>
    <rect x="6" y="2" width="12" height="20" rx="2" />
    <path d="M12 7v7M9 11l3 3 3-3" />
  </Icone>
);

/** O "Compartilhar" do Safari (quadrado com seta para cima), para o aviso de instalação no iPhone. */
export const IconeCompartilhar = (p: Props) => (
  <Icone {...p}>
    <path d="M8 10H6v11h12V10h-2" />
    <path d="M12 3v12M8.5 6.5 12 3l3.5 3.5" />
  </Icone>
);

export const IconeCoracao = ({ className = 'icone' }: Props) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z" />
  </svg>
);

export const IconePlacar = (p: Props) => (
  <Icone {...p}>
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3" />
  </Icone>
);

/** Balão de conversa com um fone, desenhado à mão (não é a marca oficial). */
export const IconeWhatsApp = (p: Props) => (
  <Icone {...p}>
    <path d="M3 21l1.6-4.9A9 9 0 1 1 8 19.6L3 21z" />
    <path d="M9 9c0 3 3 6 6 6l1.5-1.5-2-1-1 .8c-1-.4-2-1.4-2.4-2.4l.8-1-1-2L9 9z" />
  </Icone>
);

export const IconeAbaixo = (p: Props) => (
  <Icone {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icone>
);

/** Controles do replay. */
export const IconeAnterior = (p: Props) => (
  <Icone {...p}>
    <path d="M15 6l-6 6 6 6" />
  </Icone>
);

export const IconeProximo = (p: Props) => (
  <Icone {...p}>
    <path d="M9 6l6 6-6 6" />
  </Icone>
);

export const IconePularRodada = (p: Props) => (
  <Icone {...p}>
    <path d="M5 6l7 6-7 6zM13 6l7 6-7 6z" />
  </Icone>
);

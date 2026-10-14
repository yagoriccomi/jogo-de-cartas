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

export const IconeCoracao = ({ className = 'icone' }: Props) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z" />
  </svg>
);

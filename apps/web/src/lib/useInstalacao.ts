import { useCallback, useEffect, useState } from 'react';

/** O tipo não existe no lib.dom: o evento é exclusivo de navegadores baseados em Chromium. */
interface EventoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function ehEventoInstalacao(evento: Event): evento is EventoInstalacao {
  return 'prompt' in evento && typeof evento.prompt === 'function';
}

/**
 * iPhone/iPad: o Safari não tem convite de instalação (`beforeinstallprompt`), só o menu
 * Compartilhar. O iPadOS se apresenta como Mac, então o toque desempata.
 */
function ehAparelhoApple(): boolean {
  const { userAgent, maxTouchPoints } = navigator;
  return /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
}

/** Já aberto pelo ícone da tela inicial: não há o que instalar. */
function jaInstalado(): boolean {
  const navegadorApple = navigator as Navigator & { readonly standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches || navegadorApple.standalone === true
  );
}

/**
 * Controla o convite nativo "Adicionar à tela inicial"; `podeInstalar` é falso onde o navegador
 * não oferece. `instalarPeloCompartilhar` indica o iPhone, onde só dá para instalar à mão.
 */
export function useInstalacao(): {
  podeInstalar: boolean;
  instalarPeloCompartilhar: boolean;
  instalar: () => Promise<void>;
} {
  const [evento, definirEvento] = useState<EventoInstalacao | null>(null);

  useEffect(() => {
    function aoOferecer(e: Event) {
      // Guardamos o evento para disparar o convite só quando o usuário tocar no botão.
      e.preventDefault();
      if (ehEventoInstalacao(e)) definirEvento(e);
    }
    const aoInstalar = () => definirEvento(null);
    window.addEventListener('beforeinstallprompt', aoOferecer);
    window.addEventListener('appinstalled', aoInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', aoOferecer);
      window.removeEventListener('appinstalled', aoInstalar);
    };
  }, []);

  const instalar = useCallback(async () => {
    if (!evento) return;
    await evento.prompt();
    await evento.userChoice;
    // O evento só pode ser usado uma vez, aceito ou não.
    definirEvento(null);
  }, [evento]);

  return {
    podeInstalar: evento !== null,
    instalarPeloCompartilhar: evento === null && ehAparelhoApple() && !jaInstalado(),
    instalar,
  };
}

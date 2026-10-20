interface WindowComWebkit extends Window {
  readonly webkitAudioContext?: typeof AudioContext;
}

// Um só contexto para efeitos e música: navegadores limitam quantos podem existir por página.
let contexto: AudioContext | null = null;

export function obterContexto(): AudioContext | null {
  if (contexto !== null) return contexto;
  const Construtor = window.AudioContext ?? (window as WindowComWebkit).webkitAudioContext;
  if (Construtor === undefined) return null;
  contexto = new Construtor();
  return contexto;
}

/** Navegadores só liberam áudio após um gesto do usuário; o primeiro toque destrava o contexto. */
export function destravarAudioNoPrimeiroGesto(): () => void {
  const destravar = () => {
    const ctx = obterContexto();
    if (ctx !== null && ctx.state === 'suspended') void ctx.resume();
  };
  const tipos = ['pointerdown', 'keydown', 'touchstart'] as const;
  tipos.forEach((tipo) => window.addEventListener(tipo, destravar, { passive: true }));
  return () => tipos.forEach((tipo) => window.removeEventListener(tipo, destravar));
}

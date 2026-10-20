import { useEffect } from 'react';
import { destravarAudioNoPrimeiroGesto } from './contextoDeAudio';
import { ligarMusicaAoNavegador, pedirMusica } from './musica';

/**
 * Mantém a música lo-fi tocando enquanto a tela estiver montada. Só começa depois do primeiro
 * gesto (regra de autoplay dos navegadores) e respeita o mudo, o volume e a aba oculta.
 */
export function useMusicaDeFundo(): void {
  useEffect(() => destravarAudioNoPrimeiroGesto(), []);
  useEffect(() => {
    ligarMusicaAoNavegador();
    return pedirMusica();
  }, []);
}

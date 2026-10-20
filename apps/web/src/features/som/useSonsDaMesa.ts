import { useEffect, useRef } from 'react';
import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { detectarEventos } from './eventos';
import { somEstaLigado } from './preferencia';
import { destravarAudioNoPrimeiroGesto } from './contextoDeAudio';
import { tocarEvento } from './sintetizador';
import { vibrarPara } from './vibracao';

/**
 * Toca os efeitos de fliperama e vibra conforme a mesa muda. O primeiro estado após montar
 * (entrada ou reconexão) é só guardado: o que já aconteceu antes não deve soar de novo.
 */
export function useSonsDaMesa(jogo: EstadoPartidaVisivel | null, meuId: string | null): void {
  const anterior = useRef<EstadoPartidaVisivel | null>(null);

  useEffect(() => destravarAudioNoPrimeiroGesto(), []);

  useEffect(() => {
    const antes = anterior.current;
    anterior.current = jogo;
    if (antes === null || jogo === null || meuId === null) return;
    // Mesa congelada: nada deve soar, mas o estado acima já foi guardado para comparar depois.
    if (jogo.pausa !== null || !somEstaLigado()) return;
    for (const evento of detectarEventos(antes, jogo, meuId)) {
      tocarEvento(evento);
      vibrarPara(evento);
    }
  }, [jogo, meuId]);
}

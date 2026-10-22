import { describe, expect, it } from 'vitest';
import type { EstrategiaDeJogo } from '../../src/domain/estrategia-bot';
import { jogarAVez } from '../../src/domain/jogar-a-vez';
import { criarPartida, jogarRodadaAteOFim } from '../apoio';

/** Estratégia que anota quem ela decidiu e joga sempre o primeiro permitido. */
function estrategiaQueAnota(): { decididos: string[]; estrategia: EstrategiaDeJogo } {
  const decididos: string[] = [];
  return {
    decididos,
    estrategia: {
      escolherPalpite: (_visao, jogadorId, permitidos) => {
        decididos.push(jogadorId);
        return permitidos[0] as number;
      },
      escolherCarta: (visao, jogadorId) => {
        decididos.push(jogadorId);
        return (visao.minhaMao[0] as { id: string }).id;
      },
    },
  };
}

describe('jogarAVez', () => {
  it('devePalpitarNaFaseDePalpitesComOJogadorExplicito', () => {
    const partida = criarPartida();
    const { decididos, estrategia } = estrategiaQueAnota();
    const daVez = partida.idDaVez as string;

    const jogada = jogarAVez(partida, daVez, estrategia);

    expect(jogada.tipo).toBe('palpite');
    expect(decididos).toEqual([daVez]);
    expect(partida.visaoPara(null).jogadores.find((j) => j.id === daVez)?.palpite).not.toBeNull();
  });

  it('deveJogarCartaQuandoAFaseEDeJogar', () => {
    const partida = criarPartida();
    const { decididos, estrategia } = estrategiaQueAnota();
    // A rodada 1 é cega e se resolve sozinha; a 2 já tem cartas para jogar.
    jogarRodadaAteOFim(partida);
    partida.iniciarProximaRodada();
    while (partida.faseAtual === 'palpites') {
      jogarAVez(partida, partida.idDaVez as string, estrategia);
    }
    expect(partida.faseAtual).toBe('jogando');
    const daVez = partida.idDaVez as string;
    const antes = partida.visaoPara(daVez).minhaMao.length;

    const jogada = jogarAVez(partida, daVez, estrategia);

    expect(jogada.tipo).toBe('carta');
    expect(decididos.at(-1)).toBe(daVez);
    expect(partida.visaoPara(daVez).minhaMao).toHaveLength(antes - 1);
  });
});

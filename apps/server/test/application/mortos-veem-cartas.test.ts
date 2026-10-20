import { describe, expect, it } from 'vitest';
import { CARENCIA_MS, ator, montarCenario } from '../apoio';

/** Ana (dona), Bia e Caio; Caio cai, é votado para fora e assiste à rodada seguinte eliminado. */
function mesaComCaioEliminado() {
  const c = montarCenario();
  const ana = c.criarSala();
  const bia = c.entrar(ana, 'Bia');
  const caio = c.entrar(ana, 'Caio');
  c.servico.iniciarPartida(ator(ana));

  c.desconectar(caio);
  c.relogio.avancar(CARENCIA_MS);
  c.servico.votarEspera(ator(ana), { ausenteId: caio.jogadorId, esperar: false });
  c.servico.votarEspera(ator(bia), { ausenteId: caio.jogadorId, esperar: false });
  c.jogarAteNovaRodada([ana, bia], ana);
  return { c, ana, bia, caio };
}

describe('mortos veem cartas — serviço', () => {
  it('deveEnviarAsMaosAlheiasSoAoEliminadoEDepoisQueODonoLiga', () => {
    const { c, ana, bia, caio } = mesaComCaioEliminado();
    const visaoDoCaio = () => c.partidaDe(caio);
    expect(visaoDoCaio()?.jogadores.find((j) => j.id === caio.jogadorId)?.eliminado).toBe(true);
    expect(visaoDoCaio()?.jogadores.every((j) => j.maoRevelada === null)).toBe(true);

    c.servico.definirMortosVeemCartas(ator(ana), true);

    const maoDaBia = visaoDoCaio()?.jogadores.find((j) => j.id === bia.jogadorId)?.maoRevelada;
    expect(maoDaBia).toHaveLength(c.partidaDe(bia)?.cartasPorJogador ?? -1);
    for (const vivo of [ana, bia]) {
      expect(c.partidaDe(vivo)?.jogadores.every((j) => j.maoRevelada === null)).toBe(true);
    }
  });

  it('deveRecusarQueQuemNaoEDonoTroqueAOpcao', () => {
    const { c, bia, caio } = mesaComCaioEliminado();
    expect(() => c.servico.definirMortosVeemCartas(ator(bia), true)).toThrow(
      expect.objectContaining({ codigo: 'SEM_PERMISSAO' }),
    );
    expect(() => c.servico.definirMortosVeemCartas(ator(caio), true)).toThrow(
      expect.objectContaining({ codigo: 'SEM_PERMISSAO' }),
    );
    expect(c.salaDe(bia)?.configuracao.mortosVeemCartas).toBe(false);
  });
});

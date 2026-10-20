import { CONFIGURACAO_PADRAO, LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import { ErroDeRegra } from './erros';

function inteiroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  return Number.isInteger(valor) && (valor as number) >= minimo && (valor as number) <= maximo;
}

/** Valida e devolve uma cópia limpa: campos extras enviados pelo cliente são descartados. */
export function validarConfiguracao(configuracao: unknown): ConfiguracaoPartida {
  if (typeof configuracao !== 'object' || configuracao === null) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Configuração da partida ausente.');
  }
  const {
    quantidadeBaralhos,
    vidasIniciais,
    incluirOitoNoveDez,
    mortosVeemCartas,
    prazoDaVezSegundos,
  } = configuracao as Record<string, unknown>;
  if (!inteiroEntre(quantidadeBaralhos, LIMITES.minBaralhos, LIMITES.maxBaralhos)) {
    throw new ErroDeRegra(
      'ENTRADA_INVALIDA',
      `Quantidade de baralhos deve ser entre ${LIMITES.minBaralhos} e ${LIMITES.maxBaralhos}.`,
    );
  }
  if (!inteiroEntre(vidasIniciais, LIMITES.minVidas, LIMITES.maxVidas)) {
    throw new ErroDeRegra(
      'ENTRADA_INVALIDA',
      `Vidas iniciais devem ser entre ${LIMITES.minVidas} e ${LIMITES.maxVidas}.`,
    );
  }
  if (typeof incluirOitoNoveDez !== 'boolean') {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Informe se o baralho inclui 8, 9 e 10.');
  }
  // Ausente vale `false`: um cliente antigo, ainda em cache (PWA), não conhece a opção.
  const veem = mortosVeemCartas ?? false;
  if (typeof veem !== 'boolean') {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Informe se os eliminados veem as cartas.');
  }
  return {
    quantidadeBaralhos,
    vidasIniciais,
    incluirOitoNoveDez,
    mortosVeemCartas: veem,
    prazoDaVezSegundos: validarPrazoDaVez(prazoDaVezSegundos),
  };
}

function validarPrazoDaVez(prazo: unknown): number | null {
  // Ausente vale o padrão, pelo mesmo motivo do cliente antigo acima.
  if (prazo === undefined) return CONFIGURACAO_PADRAO.prazoDaVezSegundos;
  if (prazo === null) return null;
  if (!inteiroEntre(prazo, LIMITES.minPrazoDaVezSegundos, LIMITES.maxPrazoDaVezSegundos)) {
    throw new ErroDeRegra(
      'ENTRADA_INVALIDA',
      `O tempo da vez deve ser entre ${LIMITES.minPrazoDaVezSegundos} e ${LIMITES.maxPrazoDaVezSegundos} segundos, ou sem limite.`,
    );
  }
  return prazo;
}

/** A opção que o dono pode trocar a qualquer momento, validada à parte do resto. */
export function validarMortosVeemCartas(permitir: unknown): boolean {
  if (typeof permitir !== 'boolean') {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Informe se os eliminados veem as cartas.');
  }
  return permitir;
}

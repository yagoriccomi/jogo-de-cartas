import { LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import { ErroDeRegra } from './erros';

function inteiroEntre(valor: unknown, minimo: number, maximo: number): valor is number {
  return Number.isInteger(valor) && (valor as number) >= minimo && (valor as number) <= maximo;
}

/** Valida e devolve uma cópia limpa: campos extras enviados pelo cliente são descartados. */
export function validarConfiguracao(configuracao: unknown): ConfiguracaoPartida {
  if (typeof configuracao !== 'object' || configuracao === null) {
    throw new ErroDeRegra('ENTRADA_INVALIDA', 'Configuração da partida ausente.');
  }
  const { quantidadeBaralhos, vidasIniciais, incluirOitoNoveDez } = configuracao as Record<
    string,
    unknown
  >;
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
  return { quantidadeBaralhos, vidasIniciais, incluirOitoNoveDez };
}

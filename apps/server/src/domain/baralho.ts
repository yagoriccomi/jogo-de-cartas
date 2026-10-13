import {
  NAIPES,
  VALORES,
  type Carta,
  type ConfiguracaoPartida,
  type Naipe,
  type Valor,
} from '@fodinha/shared';
import { embaralhar, type GeradorAleatorio } from './aleatoriedade';

const VALORES_OPCIONAIS: readonly Valor[] = ['8', '9', '10'];

/** Valores em jogo, do mais fraco ao mais forte (ordem do truco). */
export function valoresEmJogo(incluirOitoNoveDez: boolean): readonly Valor[] {
  if (incluirOitoNoveDez) return VALORES;
  return VALORES.filter((valor) => !VALORES_OPCIONAIS.includes(valor));
}

export function totalDeCartas(configuracao: ConfiguracaoPartida): number {
  return (
    valoresEmJogo(configuracao.incluirOitoNoveDez).length *
    NAIPES.length *
    configuracao.quantidadeBaralhos
  );
}

/**
 * Monta e embaralha o(s) baralho(s). Os ids são atribuídos DEPOIS de embaralhar,
 * por posição, para não carregarem nenhuma informação sobre a carta.
 */
export function montarBaralhoEmbaralhado(
  configuracao: ConfiguracaoPartida,
  gerar: GeradorAleatorio,
): Carta[] {
  const cartas: { valor: Valor; naipe: Naipe }[] = [];
  for (let baralho = 0; baralho < configuracao.quantidadeBaralhos; baralho++) {
    for (const valor of valoresEmJogo(configuracao.incluirOitoNoveDez)) {
      for (const naipe of NAIPES) cartas.push({ valor, naipe });
    }
  }
  return embaralhar(cartas, gerar).map((carta, posicao) => ({ ...carta, id: `c${posicao}` }));
}

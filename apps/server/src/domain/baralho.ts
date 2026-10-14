import {
  NAIPES,
  valoresEmJogo,
  type Carta,
  type ConfiguracaoPartida,
  type Naipe,
  type Valor,
} from '@fodinha/shared';
import { embaralhar, type GeradorAleatorio } from './aleatoriedade';

// O cálculo do baralho vive no pacote compartilhado porque o lobby também o exibe.
export { totalDeCartas, valoresEmJogo } from '@fodinha/shared';

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

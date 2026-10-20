import type { ReactNode } from 'react';
import {
  IlustracaoAnulacao,
  IlustracaoForca,
  IlustracaoManilha,
  IlustracaoObjetivo,
  IlustracaoPalpite,
  IlustracaoRegraDoPe,
  IlustracaoRodadas,
  IlustracaoTempo,
  IlustracaoVidas,
} from './ilustracoes';

export interface Slide {
  readonly id: string;
  readonly titulo: string;
  readonly ilustracao: ReactNode;
  readonly texto: ReactNode;
}

/** Uma regra por slide: ilustração grande e no máximo duas frases curtas. */
export const SLIDES: readonly Slide[] = [
  {
    id: 'objetivo',
    titulo: 'O objetivo',
    ilustracao: <IlustracaoObjetivo />,
    texto: (
      <>
        Acerte quantas vazas vai fazer. Quem erra perde vidas;{' '}
        <strong>o último com vida vence</strong>.
      </>
    ),
  },
  {
    id: 'rodadas',
    titulo: 'As rodadas',
    ilustracao: <IlustracaoRodadas />,
    texto: (
      <>
        Começa com 1 carta, depois 2, 3… até o máximo, e volta a 1. Na rodada de 1 carta,{' '}
        <strong>você vê a dos outros (na testa), mas não a sua</strong>; após os palpites, todas vão
        sozinhas para a mesa.
      </>
    ),
  },
  {
    id: 'palpite',
    titulo: 'O palpite',
    ilustracao: <IlustracaoPalpite />,
    texto: (
      <>
        Cada um diz quantas vazas vai fazer. Quem abre a rodada é a <strong>mão</strong>; o último a
        palpitar é o <strong>pé</strong>.
      </>
    ),
  },
  {
    id: 'pe',
    titulo: 'A regra do pé',
    ilustracao: <IlustracaoRegraDoPe />,
    texto: (
      <>
        O pé não pode escolher o número que fecha a soma com as cartas da rodada:{' '}
        <strong>alguém precisa errar</strong>!
      </>
    ),
  },
  {
    id: 'forca',
    titulo: 'Força das cartas',
    ilustracao: <IlustracaoForca />,
    texto: (
      <>
        Da mais fraca à mais forte: 4 5 6 7 Q J K A 2 3. Se a sala permitir, 8, 9 e 10 entram entre
        o 7 e a Q.
      </>
    ),
  },
  {
    id: 'manilha',
    titulo: 'A manilha',
    ilustracao: <IlustracaoManilha />,
    texto: (
      <>
        O valor logo acima da vira é a manilha e <strong>vence tudo</strong>. Entre manilhas, o
        naipe decide: paus, copas, espadas, ouros.
      </>
    ),
  },
  {
    id: 'anulacao',
    titulo: 'Iguais se anulam',
    ilustracao: <IlustracaoAnulacao />,
    texto: (
      <>
        Cartas iguais se cancelam e vence a próxima mais forte. Se todas se anularem, ninguém leva a
        vaza e <strong>quem abriu abre de novo</strong>.
      </>
    ),
  },
  {
    id: 'vidas',
    titulo: 'As vidas',
    ilustracao: <IlustracaoVidas />,
    texto: (
      <>
        Você perde <strong>1 vida por vaza de diferença</strong> entre o palpite e o resultado. Se
        todos zerarem juntos, vence quem ficou menos negativo; empate é empate.
      </>
    ),
  },
  {
    id: 'tempo',
    titulo: 'Tempo e jogadas',
    ilustracao: <IlustracaoTempo />,
    texto: (
      <>
        Na carta e no palpite, <strong>1 toque escolhe e 2 toques confirmam</strong> (no computador,
        clique). Nas reações, um toque no emoji já envia. Botão direito cancela a escolha. Se o
        tempo da vez acabar, o jogo joga por você.
      </>
    ),
  },
];

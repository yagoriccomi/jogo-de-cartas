/** Proporção do baralho (altura / largura), a mesma do CSS da carta (120 x 168). */
const PROPORCAO_ALTURA = 168 / 120;

/** Folga acima da mão para a carta selecionada/levantada e abaixo para o arco e a sombra. */
const MARGEM_TOPO = 30;
const MARGEM_BASE = 26;
/** Fração da altura da carta entre uma fileira e a seguinte (deixa valor e naipe visíveis). */
const DESLOCAMENTO_ENTRE_FILEIRAS = 0.72;
/** Inclinação máxima das pontas do leque. */
const ANGULO_MAXIMO_NAS_PONTAS = 13;
/** Quanto o arco pode afundar nas pontas, em px. */
const AFUNDAMENTO_MAXIMO_NAS_PONTAS = 28;
/** Respiro nas laterais: as cartas das pontas são giradas e, sem isso, vazariam para fora da tela. */
const MARGEM_LATERAL = 12;
/** Largura de tela usada enquanto o elemento ainda não foi medido. */
const LARGURA_PADRAO = 360;
/** Menor carta ainda legível quando a mão encolhe para caber na altura. */
const LARGURA_MINIMA_NO_COMPUTADOR = 64;
const LARGURA_MINIMA_NO_CELULAR = 52;
const PASSO_DE_ENCOLHIMENTO = 2;

interface Perfil {
  readonly larguraCarta: number;
  /** Distância máxima entre cartas (sem sobrepor = largura + folga). */
  readonly passoMaximo: number;
  /** Abaixo disso a carta fica ilegível: quebra em mais fileiras. */
  readonly passoMinimo: number;
  /** Cartas por fileira antes de abrir uma nova. */
  readonly porFileiraPreferido: number;
  readonly grausPorCarta: number;
  readonly afundamentoPorCarta: number;
}

const FOLGA_ENTRE_CARTAS_GRANDES = 12;

function perfilDoComputador(quantidade: number): Perfil {
  if (quantidade <= 6) {
    return {
      larguraCarta: 104,
      passoMaximo: 104 + FOLGA_ENTRE_CARTAS_GRANDES,
      passoMinimo: 40,
      porFileiraPreferido: 20,
      grausPorCarta: 1.3,
      afundamentoPorCarta: 0.3,
    };
  }
  return {
    larguraCarta: 92,
    passoMaximo: quantidade <= 10 ? 64 : 52,
    passoMinimo: 34,
    porFileiraPreferido: 20,
    grausPorCarta: 1.3,
    afundamentoPorCarta: 0.3,
  };
}

function perfilDoCelular(quantidade: number, larguraDisponivel: number): Perfil {
  const base = { passoMinimo: 24, grausPorCarta: 2.2, afundamentoPorCarta: 0.5 };
  if (quantidade <= 3) {
    // Poucas cartas: grandes e lado a lado, encolhendo só se a tela for muito estreita.
    const cabem = Math.floor(
      (larguraDisponivel - FOLGA_ENTRE_CARTAS_GRANDES * (quantidade - 1)) / quantidade,
    );
    const larguraCarta = Math.min(104, Math.max(cabem, 60));
    return {
      ...base,
      larguraCarta,
      passoMaximo: larguraCarta + FOLGA_ENTRE_CARTAS_GRANDES,
      porFileiraPreferido: 10,
    };
  }
  if (quantidade <= 5) {
    return { ...base, larguraCarta: 80, passoMaximo: 90, porFileiraPreferido: 10 };
  }
  if (quantidade <= 10) {
    return { ...base, larguraCarta: 70, passoMaximo: 40, porFileiraPreferido: 10 };
  }
  return { ...base, larguraCarta: 64, passoMaximo: 33, porFileiraPreferido: 10 };
}

export interface PosicaoNoLeque {
  readonly esquerda: number;
  readonly topo: number;
  readonly deslocamentoY: number;
  readonly rotacao: number;
}

export interface LayoutDoLeque {
  readonly larguraCarta: number;
  readonly alturaCarta: number;
  readonly passo: number;
  readonly fileiras: number;
  readonly porFileira: number;
  /** `true` quando as cartas se sobrepõem tanto que o valor precisa encolher. */
  readonly densa: boolean;
  readonly larguraTotal: number;
  readonly alturaTotal: number;
  readonly posicoes: readonly PosicaoNoLeque[];
}

interface Entrada {
  readonly quantidade: number;
  readonly larguraDisponivel: number;
  readonly computador: boolean;
  /** Acima desta altura as cartas encolhem (até um mínimo legível): o feltro e o palpite não somem. */
  readonly alturaMaxima?: number;
}

/**
 * Calcula onde cada carta fica no leque. Sempre cabe na largura disponível: se o passo ideal não
 * couber (ou ficar ilegível), as cartas se dividem em fileiras sobrepostas verticalmente, de
 * forma equilibrada (ex.: 21 cartas viram 11 + 10). A ordem recebida do servidor é preservada:
 * mais forte na primeira posição da primeira fileira.
 */
export function calcularLeque({
  quantidade,
  larguraDisponivel,
  computador,
  alturaMaxima = Number.POSITIVE_INFINITY,
}: Entrada): LayoutDoLeque {
  const disponivel =
    (larguraDisponivel > 0 ? larguraDisponivel : LARGURA_PADRAO) - 2 * MARGEM_LATERAL;
  const perfil = computador
    ? perfilDoComputador(quantidade)
    : perfilDoCelular(quantidade, disponivel);
  const larguraMinima = Math.min(
    perfil.larguraCarta,
    computador ? LARGURA_MINIMA_NO_COMPUTADOR : LARGURA_MINIMA_NO_CELULAR,
  );

  let layout = montarLeque(quantidade, disponivel, perfil);
  for (
    let largura = perfil.larguraCarta - PASSO_DE_ENCOLHIMENTO;
    layout.alturaTotal > alturaMaxima && largura >= larguraMinima;
    largura -= PASSO_DE_ENCOLHIMENTO
  ) {
    const escala = largura / perfil.larguraCarta;
    layout = montarLeque(quantidade, disponivel, {
      ...perfil,
      larguraCarta: largura,
      passoMaximo: perfil.passoMaximo * escala,
    });
  }
  return layout;
}

function montarLeque(quantidade: number, disponivel: number, perfil: Perfil): LayoutDoLeque {
  const { larguraCarta, passoMinimo, passoMaximo } = perfil;
  const alturaCarta = Math.round(larguraCarta * PROPORCAO_ALTURA);

  const maximoQueCabe = Math.max(1, Math.floor((disponivel - larguraCarta) / passoMinimo) + 1);
  let fileiras = Math.max(1, Math.ceil(quantidade / perfil.porFileiraPreferido));
  let porFileira = Math.ceil(quantidade / fileiras);
  if (porFileira > maximoQueCabe) {
    fileiras = Math.ceil(quantidade / maximoQueCabe);
    porFileira = Math.ceil(quantidade / fileiras);
  }

  const passo =
    porFileira > 1 ? Math.min(passoMaximo, (disponivel - larguraCarta) / (porFileira - 1)) : 0;
  const larguraTotal = porFileira > 1 ? (porFileira - 1) * passo + larguraCarta : larguraCarta;
  const deslocamentoEntreFileiras = Math.round(alturaCarta * DESLOCAMENTO_ENTRE_FILEIRAS);

  const posicoes: PosicaoNoLeque[] = [];
  for (let indice = 0; indice < quantidade; indice += 1) {
    const fileira = Math.floor(indice / porFileira);
    const coluna = indice % porFileira;
    const naFileira = Math.min(porFileira, quantidade - fileira * porFileira);
    const meio = (naFileira - 1) / 2;
    const distancia = coluna - meio;
    const larguraDaFileira = naFileira > 1 ? (naFileira - 1) * passo + larguraCarta : larguraCarta;

    const grausPorCarta = Math.min(
      perfil.grausPorCarta,
      ANGULO_MAXIMO_NAS_PONTAS / Math.max(meio, 1),
    );
    const afundamentoPorCarta = Math.min(
      perfil.afundamentoPorCarta,
      AFUNDAMENTO_MAXIMO_NAS_PONTAS / Math.max(meio * meio, 1),
    );

    posicoes.push({
      esquerda: MARGEM_LATERAL + (larguraTotal - larguraDaFileira) / 2 + coluna * passo,
      topo: MARGEM_TOPO + fileira * deslocamentoEntreFileiras,
      deslocamentoY: distancia * distancia * afundamentoPorCarta,
      rotacao: distancia * grausPorCarta,
    });
  }

  return {
    larguraCarta,
    alturaCarta,
    passo,
    fileiras,
    porFileira,
    densa: passo > 0 && passo / larguraCarta < 0.52,
    larguraTotal: larguraTotal + 2 * MARGEM_LATERAL,
    alturaTotal:
      MARGEM_TOPO + alturaCarta + (fileiras - 1) * deslocamentoEntreFileiras + MARGEM_BASE,
    posicoes,
  };
}

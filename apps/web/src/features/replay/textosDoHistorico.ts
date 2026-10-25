import type { PartidaNoHistorico } from '@fodinha/shared';

/** Textos de "Minhas partidas", fora do componente para serem testados sem tela. */

export function descreverColocacao({ colocacao, venceu }: PartidaNoHistorico): string {
  if (venceu) return 'Venceu';
  return colocacao === null ? 'Sem colocação' : `${colocacao}º lugar`;
}

export function descreverMesa({ jogadores, rodadas }: PartidaNoHistorico): string {
  const jogadoresTexto = `${jogadores} ${jogadores === 1 ? 'jogador' : 'jogadores'}`;
  return `${jogadoresTexto} · ${rodadas} ${rodadas === 1 ? 'rodada' : 'rodadas'}`;
}

const FORMATO_DA_DATA = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function descreverData(instante: number): string {
  return FORMATO_DA_DATA.format(new Date(instante));
}

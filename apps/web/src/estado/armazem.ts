import { useSyncExternalStore } from 'react';
import type { EstadoPartidaVisivel, EstadoSala, SessaoJogador } from '@fodinha/shared';
import { lerSessao } from '../lib/sessao';

export type TipoAviso = 'erro' | 'info' | 'sucesso';
export type StatusConexao = 'conectando' | 'conectado' | 'desconectado';

export interface Aviso {
  readonly id: number;
  readonly tipo: TipoAviso;
  readonly mensagem: string;
}

export interface EstadoApp {
  readonly conexao: StatusConexao;
  /** `true` enquanto tenta retomar a sessão guardada (abertura da página). */
  readonly retomando: boolean;
  readonly sessao: SessaoJogador | null;
  readonly sala: EstadoSala | null;
  readonly jogo: EstadoPartidaVisivel | null;
  /**
   * Instante local (epoch ms) em que o último `jogo:estado` chegou. As contagens regressivas
   * partem dele + o "tempo restante" do servidor, ficando imunes a relógio desajustado.
   */
  readonly jogoRecebidoEm: number;
  /** Escolha local de rever o lobby depois que a partida encerrou. */
  readonly voltouAoLobby: boolean;
  /** Mensagem fixa exibida na tela inicial (ex.: "você foi expulso"). */
  readonly avisoEntrada: string | null;
  readonly avisos: readonly Aviso[];
  /** Tutorial em andamento: a mesa é alimentada por um roteiro local, não pelo servidor. */
  readonly tutorial: EstadoTutorial | null;
}

export interface EstadoTutorial {
  /** Passo atual do roteiro (índice). */
  readonly passo: number;
}

const DURACAO_AVISO_MS = 6000;

let estado: EstadoApp = {
  conexao: 'conectando',
  retomando: lerSessao() !== null,
  sessao: null,
  sala: null,
  jogo: null,
  jogoRecebidoEm: Date.now(),
  voltouAoLobby: false,
  avisoEntrada: null,
  avisos: [],
  tutorial: null,
};
let proximoIdAviso = 1;
const ouvintes = new Set<() => void>();

export function obterEstado(): EstadoApp {
  return estado;
}

export function atualizar(
  parcial: Partial<EstadoApp> | ((atual: EstadoApp) => Partial<EstadoApp>),
): void {
  const mudanca = typeof parcial === 'function' ? parcial(estado) : parcial;
  estado = { ...estado, ...mudanca };
  ouvintes.forEach((ouvinte) => ouvinte());
}

function assinar(ouvinte: () => void): () => void {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

export function useApp(): EstadoApp {
  return useSyncExternalStore(assinar, obterEstado);
}

export function avisar(tipo: TipoAviso, mensagem: string): void {
  // Mensagem idêntica já visível não precisa empilhar de novo.
  if (estado.avisos.some((a) => a.mensagem === mensagem && a.tipo === tipo)) return;
  const id = proximoIdAviso++;
  atualizar((atual) => ({ avisos: [...atual.avisos, { id, tipo, mensagem }] }));
  setTimeout(() => dispensarAviso(id), DURACAO_AVISO_MS);
}

export function dispensarAviso(id: number): void {
  atualizar((atual) => ({ avisos: atual.avisos.filter((a) => a.id !== id) }));
}

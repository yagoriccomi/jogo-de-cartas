import { useCallback, useEffect, useState } from 'react';
import type { MotivoDoErroDoHistorico, PartidaNoHistorico } from '@fodinha/shared';
import { Dialogo } from '../../componentes/Dialogo';
import { IconeFechar } from '../../componentes/Icones';
import { classes } from '../../lib/classes';
import { useAcao } from '../../lib/useAcao';
import { useLogin } from '../login/login';
import { buscarMinhasPartidas } from './historico';
import { iniciarReplay } from './motor';
import { descreverColocacao, descreverData, descreverMesa } from './textosDoHistorico';
import './replay.css';

/** Sem login ou sem banco no servidor, "Minhas partidas" nem aparece. */
const MOTIVOS_QUE_ESCONDEM: readonly MotivoDoErroDoHistorico[] = ['sem_login', 'desligado'];

type Lista =
  | { readonly fase: 'carregando' }
  | { readonly fase: 'escondida' }
  | { readonly fase: 'erro'; readonly mensagem: string }
  | {
      readonly fase: 'pronta';
      readonly partidas: readonly PartidaNoHistorico[];
      readonly proximoCursor: string | null;
      readonly carregandoMais: boolean;
    };

/** Primeira página ao logar; "Carregar mais" acrescenta as seguintes à mesma lista. */
function useMinhasPartidas(logado: boolean) {
  const [lista, definirLista] = useState<Lista>({ fase: 'carregando' });

  const carregar = useCallback(async (cursor: string | null) => {
    const resposta = await buscarMinhasPartidas(cursor);
    definirLista((atual) => {
      if (!resposta.ok) {
        if (MOTIVOS_QUE_ESCONDEM.includes(resposta.motivo)) return { fase: 'escondida' };
        // Falha ao carregar mais não apaga o que já está na tela.
        if (cursor !== null && atual.fase === 'pronta') return { ...atual, carregandoMais: false };
        return { fase: 'erro', mensagem: resposta.mensagem };
      }
      const anteriores = cursor !== null && atual.fase === 'pronta' ? atual.partidas : [];
      return {
        fase: 'pronta',
        partidas: [...anteriores, ...resposta.dados.partidas],
        proximoCursor: resposta.dados.proximoCursor,
        carregandoMais: false,
      };
    });
  }, []);

  useEffect(() => {
    if (logado) void carregar(null);
  }, [logado, carregar]);

  const recarregar = () => {
    definirLista({ fase: 'carregando' });
    void carregar(null);
  };
  const carregarMais = () => {
    if (lista.fase !== 'pronta' || lista.proximoCursor === null || lista.carregandoMais) return;
    definirLista({ ...lista, carregandoMais: true });
    void carregar(lista.proximoCursor);
  };
  return { lista, recarregar, carregarMais };
}

function ItemDaPartida({
  partida,
  ocupado,
  onRever,
}: {
  readonly partida: PartidaNoHistorico;
  readonly ocupado: boolean;
  readonly onRever: () => void;
}) {
  return (
    <li className="historico__item">
      <div className="historico__dados">
        <span className="historico__data">{descreverData(partida.iniciadaEm)}</span>
        <span className="historico__mesa">{descreverMesa(partida)}</span>
      </div>
      <span className={classes('selo', partida.venceu ? 'selo--pe' : 'selo--alerta')}>
        {descreverColocacao(partida)}
      </span>
      <button type="button" className="botao historico__rever" disabled={ocupado} onClick={onRever}>
        Rever
      </button>
    </li>
  );
}

/**
 * Entrada de quem está logado: o botão e o diálogo com as partidas terminadas, da mais recente
 * para trás. "Rever" abre o replay na mesa de verdade.
 */
export function MinhasPartidas() {
  const { situacao } = useLogin();
  const logado = situacao.fase === 'logado';
  const { lista, recarregar, carregarMais } = useMinhasPartidas(logado);
  const [aberto, definirAberto] = useState(false);
  const [abrindo, executar] = useAcao();

  if (!logado || lista.fase === 'escondida') return null;

  return (
    <>
      <button type="button" className="botao botao--bloco" onClick={() => definirAberto(true)}>
        Minhas partidas
      </button>
      {aberto && (
        <Dialogo idTitulo="titulo-historico" variante="folha" onFechar={() => definirAberto(false)}>
          <div className="dialogo__cabecalho">
            <h2 id="titulo-historico" className="neon dialogo__titulo">
              Minhas partidas
            </h2>
            <button
              type="button"
              className="botao botao--texto botao--icone"
              aria-label="Fechar"
              onClick={() => definirAberto(false)}
            >
              <IconeFechar />
            </button>
          </div>

          {lista.fase === 'carregando' && (
            <p className="dialogo__texto" role="status">
              Buscando suas partidas…
            </p>
          )}
          {lista.fase === 'erro' && (
            <div className="historico__erro" role="alert">
              <p className="dialogo__texto">{lista.mensagem}</p>
              <button type="button" className="botao" onClick={recarregar}>
                Tentar de novo
              </button>
            </div>
          )}
          {lista.fase === 'pronta' && lista.partidas.length === 0 && (
            <p className="dialogo__texto">
              Nenhuma partida terminada ainda. Jogue logado até o fim e ela aparece aqui para rever.
            </p>
          )}
          {lista.fase === 'pronta' && lista.partidas.length > 0 && (
            <>
              <ul className="historico__lista" aria-label="Partidas terminadas">
                {lista.partidas.map((partida) => (
                  <ItemDaPartida
                    key={partida.id}
                    partida={partida}
                    ocupado={abrindo}
                    onRever={() => void executar(() => iniciarReplay(partida.id))}
                  />
                ))}
              </ul>
              {lista.proximoCursor !== null && (
                <button
                  type="button"
                  className="botao botao--texto"
                  disabled={lista.carregandoMais}
                  onClick={carregarMais}
                >
                  {lista.carregandoMais ? 'Carregando…' : 'Carregar mais'}
                </button>
              )}
            </>
          )}
          {abrindo && (
            <p className="dialogo__texto" role="status">
              Abrindo o replay…
            </p>
          )}
        </Dialogo>
      )}
    </>
  );
}

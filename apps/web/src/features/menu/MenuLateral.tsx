import { useState } from 'react';
import { Dialogo } from '../../componentes/Dialogo';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import {
  IconeExpulsar,
  IconeFechar,
  IconeLink,
  IconeLivro,
  IconePausar,
  IconeReiniciar,
  IconeRetomar,
  IconeSair,
} from '../../componentes/Icones';
import {
  expulsarParticipante,
  pausarPartida,
  reiniciarSala,
  retomarPartida,
  sairDaSala,
} from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { BotaoWhatsApp } from '../../componentes/BotaoWhatsApp';
import { convidar } from '../../estado/convite';
import { useAcao } from '../../lib/useAcao';
import { DialogoRegras } from './DialogoRegras';

interface Props {
  readonly onFechar: () => void;
}

type Confirmacao =
  | { readonly tipo: 'reiniciar' }
  | { readonly tipo: 'sair' }
  | {
      readonly tipo: 'expulsar';
      readonly participanteId: string;
      readonly apelido: string;
      readonly ehBot: boolean;
    };

/** Gaveta lateral: convite, regras e, só para o dono, pausar, reiniciar e expulsar jogadores. */
export function MenuLateral({ onFechar }: Props) {
  const { sala, sessao, jogo, tutorial } = useApp();
  const [regrasAbertas, definirRegrasAbertas] = useState(false);
  const [listaAberta, definirListaAberta] = useState(false);
  const [confirmacao, definirConfirmacao] = useState<Confirmacao | null>(null);
  const [ocupado, executar] = useAcao();

  if (!sala || !sessao) return null;

  const eu = sala.participantes.find((p) => p.id === sessao.jogadorId);
  const souDono = eu?.ehAnfitriao ?? false;
  const expulsaveis = sala.participantes.filter((p) => p.id !== sessao.jogadorId && !p.saindo);
  const pausadaPorMim = jogo?.pausa?.pausadaPeloDono ?? false;

  function alternarPausa() {
    void executar(async () => {
      const sucesso = pausadaPorMim ? await retomarPartida() : await pausarPartida();
      if (sucesso) onFechar();
    });
  }

  function confirmar() {
    if (!confirmacao) return;
    void executar(async () => {
      if (confirmacao.tipo === 'sair') {
        await sairDaSala();
        return;
      }
      const sucesso =
        confirmacao.tipo === 'reiniciar'
          ? await reiniciarSala()
          : await expulsarParticipante(confirmacao.participanteId);
      definirConfirmacao(null);
      if (sucesso && confirmacao.tipo === 'reiniciar') onFechar();
    });
  }

  return (
    <>
      <Dialogo idTitulo="titulo-menu" variante="gaveta" destaque="ciano" onFechar={onFechar}>
        <div className="dialogo__cabecalho">
          <h2 id="titulo-menu" className="neon neon--ciano dialogo__titulo">
            Menu
          </h2>
          <button
            type="button"
            className="botao botao--texto botao--icone"
            aria-label="Fechar menu"
            onClick={onFechar}
          >
            <IconeFechar />
          </button>
        </div>

        <nav className="menu" aria-label="Menu da partida">
          {/* No tutorial não há sala de verdade para convidar ninguém. */}
          {!tutorial && (
            <div className="menu__sala">
              <div>
                <span className="rotulo-pequeno">Sala</span>
                <strong className="menu__codigo">{sala.codigo}</strong>
              </div>
              <div className="menu__convites">
                <button type="button" className="botao" onClick={() => void convidar(sala.codigo)}>
                  <IconeLink className="icone" />
                  Convidar
                </button>
                <BotaoWhatsApp codigo={sala.codigo} />
              </div>
            </div>
          )}

          <button type="button" className="menu__item" onClick={() => definirRegrasAbertas(true)}>
            <IconeLivro />
            <span className="menu__texto">Regras do jogo</span>
            <span className="menu__seta" aria-hidden="true">
              ›
            </span>
          </button>

          {souDono && (
            <div className="menu__dono">
              <span className="menu__dono-titulo">Só para o dono da sala</span>
              {sala.emPartida && (
                <button
                  type="button"
                  className="menu__item menu__item--dono"
                  disabled={ocupado}
                  onClick={alternarPausa}
                >
                  {pausadaPorMim ? <IconeRetomar /> : <IconePausar />}
                  <span className="menu__texto">
                    {pausadaPorMim ? 'Retomar partida' : 'Pausar partida'}
                    <small>
                      {pausadaPorMim
                        ? 'O tempo da vez e os bots voltam a correr'
                        : 'Congela a mesa até você retomar'}
                    </small>
                  </span>
                </button>
              )}
              {sala.emPartida && (
                <button
                  type="button"
                  className="menu__item menu__item--dono"
                  onClick={() => definirConfirmacao({ tipo: 'reiniciar' })}
                >
                  <IconeReiniciar />
                  <span className="menu__texto">
                    Reiniciar sala
                    <small>Volta à rodada 1, vidas cheias para todos</small>
                  </span>
                </button>
              )}
              <button
                type="button"
                className="menu__item menu__item--dono"
                aria-expanded={listaAberta}
                onClick={() => definirListaAberta((aberta) => !aberta)}
              >
                <IconeExpulsar />
                <span className="menu__texto">
                  Expulsar jogador
                  <small>Quem for expulso não volta nesta sala</small>
                </span>
                <span className="menu__seta" aria-hidden="true">
                  {listaAberta ? '⌄' : '›'}
                </span>
              </button>
              {listaAberta && (
                <ul className="menu__expulsar">
                  {expulsaveis.length === 0 && (
                    <li className="menu__vazio">Ninguém além de você.</li>
                  )}
                  {expulsaveis.map((p) => (
                    <li key={p.id}>
                      <span>{p.apelido}</span>
                      <button
                        type="button"
                        className={
                          p.ehBot ? 'botao menu__remover' : 'botao botao--perigo menu__remover'
                        }
                        aria-label={`${p.ehBot ? 'Remover' : 'Expulsar'} ${p.apelido}`}
                        onClick={() =>
                          definirConfirmacao({
                            tipo: 'expulsar',
                            participanteId: p.id,
                            apelido: p.apelido,
                            ehBot: p.ehBot,
                          })
                        }
                      >
                        {p.ehBot ? 'Remover' : 'Expulsar'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <button
            type="button"
            className="botao botao--perigo botao--bloco menu__sair"
            onClick={() => definirConfirmacao({ tipo: 'sair' })}
          >
            <IconeSair />
            Sair da sala
          </button>
        </nav>
      </Dialogo>

      {regrasAbertas && <DialogoRegras onFechar={() => definirRegrasAbertas(false)} />}

      {confirmacao?.tipo === 'reiniciar' && (
        <DialogoConfirmacao
          titulo="Reiniciar sala?"
          texto="A partida volta à rodada 1 e todos recomeçam com as vidas cheias."
          rotuloConfirmar="Reiniciar"
          ocupado={ocupado}
          onConfirmar={confirmar}
          onCancelar={() => definirConfirmacao(null)}
        />
      )}
      {confirmacao?.tipo === 'expulsar' && (
        <DialogoConfirmacao
          titulo={confirmacao.ehBot ? 'Remover bot?' : 'Expulsar jogador?'}
          texto={
            confirmacao.ehBot
              ? `${confirmacao.apelido} sai da mesa.`
              : `${confirmacao.apelido} sai da sala e não consegue voltar a ela.`
          }
          rotuloConfirmar={confirmacao.ehBot ? 'Remover' : 'Expulsar'}
          ocupado={ocupado}
          onConfirmar={confirmar}
          onCancelar={() => definirConfirmacao(null)}
        />
      )}
      {confirmacao?.tipo === 'sair' && (
        <DialogoConfirmacao
          titulo="Sair da sala?"
          texto="Você deixa a mesa. Se a partida estiver rolando, um bot termina a rodada por você."
          rotuloConfirmar="Sair"
          ocupado={ocupado}
          onConfirmar={confirmar}
          onCancelar={() => definirConfirmacao(null)}
        />
      )}
    </>
  );
}

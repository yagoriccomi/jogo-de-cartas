import { LIMITES } from '@fodinha/shared';
import { ConfiguracaoControles } from '../../componentes/ConfiguracaoControles';
import {
  adicionarBot,
  configurarSala,
  iniciarPartida,
  removerParticipante,
  sairDaSala,
} from '../../estado/acoes';
import { avisar, useApp } from '../../estado/armazem';
import { descreverErro, registrar } from '../../lib/log';
import { useAcao } from '../../lib/useAcao';
import './lobby.css';

function montarLinkDeConvite(codigo: string): string {
  return `${window.location.origin}/?sala=${encodeURIComponent(codigo)}`;
}

export function TelaLobby() {
  const { sala, sessao } = useApp();
  const [ocupado, executar] = useAcao();

  // O roteador já garante sala e sessão; o guard satisfaz o compilador sem `!`.
  if (!sala || !sessao) return null;

  const eu = sala.participantes.find((p) => p.id === sessao.jogadorId);
  const ehAnfitriao = eu?.ehAnfitriao ?? false;
  const total = sala.participantes.length;
  const bots = sala.participantes.filter((p) => p.ehBot).length;
  const podeAdicionarBot = total < LIMITES.maxJogadores && bots < LIMITES.maxBots;
  const podeIniciar = total >= LIMITES.minJogadores;

  async function copiarLink() {
    if (!sala) return;
    const link = montarLinkDeConvite(sala.codigo);
    try {
      await navigator.clipboard.writeText(link);
      avisar('sucesso', 'Link de convite copiado!');
    } catch (erro) {
      registrar('warn', 'lobby.copiar_falhou', descreverErro(erro));
      // Sem permissão de área de transferência: mostra o link para o usuário copiar à mão.
      avisar('info', `Copie o link: ${link}`);
    }
  }

  return (
    <div className="lobby">
      <section className="cartao lobby__codigo">
        <span className="cartao__titulo">Código da sala</span>
        <strong
          className="lobby__codigo-valor"
          aria-label={`Código ${sala.codigo.split('').join(' ')}`}
        >
          {sala.codigo}
        </strong>
        <button type="button" className="botao" onClick={() => void copiarLink()}>
          Copiar link de convite
        </button>
      </section>

      <section className="cartao">
        <h2 className="cartao__titulo">
          Participantes ({total}/{LIMITES.maxJogadores})
        </h2>
        <ul className="lobby__lista">
          {sala.participantes.map((p) => (
            <li key={p.id} className="lobby__item">
              <span className="lobby__nome">
                {p.apelido}
                {p.id === sessao.jogadorId && <span className="lobby__voce"> (você)</span>}
              </span>
              <span className="lobby__selos">
                {p.ehAnfitriao && <span className="selo selo--destaque">Anfitrião</span>}
                {p.ehBot && <span className="selo">Bot</span>}
                {!p.conectado && !p.ehBot && <span className="selo selo--alerta">Offline</span>}
              </span>
              {ehAnfitriao && p.id !== sessao.jogadorId && (
                <button
                  type="button"
                  className="botao botao--discreto botao--perigo"
                  disabled={ocupado}
                  aria-label={`Remover ${p.apelido}`}
                  onClick={() => void executar(() => removerParticipante(p.id))}
                >
                  Remover
                </button>
              )}
            </li>
          ))}
        </ul>
        {total < LIMITES.minJogadores && (
          <p className="lobby__vazio">
            Convide alguém pelo link ou adicione um bot para começar (mínimo de{' '}
            {LIMITES.minJogadores}).
          </p>
        )}
        {ehAnfitriao && (
          <button
            type="button"
            className="botao botao--bloco lobby__bot"
            disabled={ocupado || !podeAdicionarBot}
            onClick={() => void executar(adicionarBot)}
          >
            Adicionar bot ({bots}/{LIMITES.maxBots})
          </button>
        )}
      </section>

      <section className="cartao">
        <h2 className="cartao__titulo">Configuração</h2>
        <ConfiguracaoControles
          valor={sala.configuracao}
          desabilitado={!ehAnfitriao || ocupado}
          onChange={(configuracao) => void executar(() => configurarSala(configuracao))}
        />
        {!ehAnfitriao && (
          <p className="lobby__vazio">Só o anfitrião pode alterar a configuração.</p>
        )}
      </section>

      <div className="lobby__acoes">
        {ehAnfitriao ? (
          <button
            type="button"
            className="botao botao--primario botao--bloco"
            disabled={ocupado || !podeIniciar}
            onClick={() => void executar(iniciarPartida)}
          >
            Iniciar partida
          </button>
        ) : (
          <p className="lobby__vazio" role="status">
            Aguardando o anfitrião iniciar a partida…
          </p>
        )}
        <button
          type="button"
          className="botao botao--bloco botao--perigo"
          onClick={() => void sairDaSala()}
        >
          Sair da sala
        </button>
      </div>
    </div>
  );
}

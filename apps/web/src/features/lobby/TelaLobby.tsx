import { useState } from 'react';
import {
  LIMITES,
  maxCartasPorJogador,
  totalDeCartas,
  type ConfiguracaoPartida,
  type ParticipanteSala,
} from '@fodinha/shared';
import { ConfiguracaoControles } from '../../componentes/ConfiguracaoControles';
import { DialogoConfirmacao } from '../../componentes/DialogoConfirmacao';
import { IconeExpulsar, IconeFechar } from '../../componentes/Icones';
import {
  adicionarBot,
  configurarSala,
  expulsarParticipante,
  iniciarPartida,
} from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { compartilharConviteComAviso, copiarConviteComAviso } from '../../estado/convite';
import { BotaoWhatsApp } from '../../componentes/BotaoWhatsApp';
import { podeCompartilhar } from '../../lib/convite';
import { useAcao } from '../../lib/useAcao';
import { CabecalhoApp } from '../menu/CabecalhoApp';
import './lobby.css';

function descreverConfiguracao(configuracao: ConfiguracaoPartida): string {
  const baralhos =
    configuracao.quantidadeBaralhos === 1
      ? '1 baralho'
      : `${configuracao.quantidadeBaralhos} baralhos`;
  const faixa = configuracao.incluirOitoNoveDez ? 'com 8, 9 e 10' : 'sem 8, 9 e 10';
  return `${baralhos} · ${configuracao.vidasIniciais} vidas · ${faixa}`;
}

function inicialDe(apelido: string): string {
  return apelido.trim().charAt(0).toUpperCase() || '?';
}

export function TelaLobby() {
  const { sala, sessao } = useApp();
  const [ocupado, executar] = useAcao();
  const [editando, definirEditando] = useState(false);
  const [paraExpulsar, definirParaExpulsar] = useState<ParticipanteSala | null>(null);

  // O roteador já garante sala e sessão; o guard satisfaz o compilador sem `!`.
  if (!sala || !sessao) return null;

  const eu = sala.participantes.find((p) => p.id === sessao.jogadorId);
  const souDono = eu?.ehAnfitriao ?? false;
  const total = sala.participantes.length;
  const bots = sala.participantes.filter((p) => p.ehBot).length;
  const podeAdicionarBot = total < LIMITES.maxJogadores && bots < LIMITES.maxBots;
  const podeIniciar = total >= LIMITES.minJogadores;

  // Com poucos jogadores o máximo de cartas por rodada é maior; o mínimo evita dividir por zero.
  const maximoDeCartas = maxCartasPorJogador(
    totalDeCartas(sala.configuracao),
    Math.max(total, LIMITES.minJogadores),
  );

  function expulsar(participante: ParticipanteSala) {
    // Bot só é removido: dispensa confirmação. Humano expulso não volta, então confirma antes.
    if (participante.ehBot) void executar(() => expulsarParticipante(participante.id));
    else definirParaExpulsar(participante);
  }

  function confirmarExpulsao() {
    if (!paraExpulsar) return;
    void executar(async () => {
      await expulsarParticipante(paraExpulsar.id);
      definirParaExpulsar(null);
    });
  }

  return (
    <div className="lobby">
      <CabecalhoApp />

      <section className="painel painel--neon lobby__codigo" aria-label="Código da sala">
        <span className="rotulo-pequeno">Código da sala</span>
        <strong
          className="lobby__codigo-valor"
          aria-label={`Código ${sala.codigo.split('').join(' ')}`}
        >
          {sala.codigo}
        </strong>
        <div className="lobby__convite">
          <button
            type="button"
            className="botao"
            onClick={() => void copiarConviteComAviso(sala.codigo)}
          >
            Copiar link
          </button>
          {podeCompartilhar() && (
            <button
              type="button"
              className="botao"
              onClick={() => void compartilharConviteComAviso(sala.codigo)}
            >
              Compartilhar
            </button>
          )}
          <BotaoWhatsApp codigo={sala.codigo} />
        </div>
      </section>

      <section className="lobby__mesa" aria-labelledby="titulo-na-mesa">
        <div className="lobby__titulo">
          <h2 id="titulo-na-mesa">Na mesa</h2>
          <span>
            {total} de {LIMITES.maxJogadores} · {bots} {bots === 1 ? 'bot' : 'bots'}
          </span>
        </div>

        <ul className="lobby__lista">
          {sala.participantes.map((p) => (
            <li key={p.id} className="lobby__item">
              <span
                className={p.ehBot ? 'lobby__avatar lobby__avatar--bot' : 'lobby__avatar'}
                aria-hidden="true"
              >
                {p.ehBot ? 'BOT' : inicialDe(p.apelido)}
              </span>
              <span className="lobby__nome">
                {p.apelido}
                {p.id === sessao.jogadorId && <span className="lobby__voce"> (você)</span>}
              </span>
              <span className="lobby__selos">
                {p.ehAnfitriao && <span className="selo selo--dono">Dono</span>}
                {!p.conectado && !p.ehBot && <span className="selo selo--alerta">Offline</span>}
                {p.aguardandoProximaRodada && (
                  <span className="selo selo--alerta">Próxima rodada</span>
                )}
                {p.saindo && <span className="selo selo--alerta">Saindo</span>}
              </span>
              {souDono && p.id !== sessao.jogadorId && !p.saindo && (
                <button
                  type="button"
                  className="botao botao--texto botao--icone lobby__expulsar"
                  disabled={ocupado}
                  aria-label={`${p.ehBot ? 'Remover' : 'Expulsar'} ${p.apelido}`}
                  onClick={() => expulsar(p)}
                >
                  {p.ehBot ? <IconeFechar /> : <IconeExpulsar />}
                </button>
              )}
            </li>
          ))}
        </ul>

        {total < LIMITES.minJogadores && (
          <p className="lobby__vazio">
            Convide alguém pelo link ou adicione um bot para começar (mínimo de{' '}
            {LIMITES.minJogadores}
            ).
          </p>
        )}
        {souDono && (
          <button
            type="button"
            className="botao botao--tracejado botao--bloco"
            disabled={ocupado || !podeAdicionarBot}
            onClick={() => void executar(adicionarBot)}
          >
            + Adicionar bot ({bots}/{LIMITES.maxBots})
          </button>
        )}
      </section>

      <section className="painel lobby__config" aria-label="Configuração da partida">
        <div className="lobby__config-resumo">
          <div className="lobby__config-texto">
            <strong>{descreverConfiguracao(sala.configuracao)}</strong>
            <span>Rodadas de 1 a {maximoDeCartas} cartas e volta a 1</span>
          </div>
          {souDono && (
            <button
              type="button"
              className="botao botao--texto"
              aria-expanded={editando}
              onClick={() => definirEditando((aberto) => !aberto)}
            >
              {editando ? 'Pronto' : 'Editar'}
            </button>
          )}
        </div>
        {souDono && editando && (
          <ConfiguracaoControles
            valor={sala.configuracao}
            desabilitado={ocupado}
            onChange={(configuracao) => void executar(() => configurarSala(configuracao))}
          />
        )}
        {!souDono && <p className="lobby__vazio">Só o dono da sala pode alterar a configuração.</p>}
      </section>

      <div className="lobby__acoes">
        {souDono ? (
          <button
            type="button"
            className="botao botao--primario botao--bloco"
            disabled={ocupado || !podeIniciar}
            onClick={() => void executar(iniciarPartida)}
          >
            Iniciar partida
          </button>
        ) : (
          <p className="lobby__espera" role="status">
            Aguardando o dono da sala iniciar a partida…
          </p>
        )}
      </div>

      {paraExpulsar && (
        <DialogoConfirmacao
          titulo="Expulsar jogador?"
          texto={`${paraExpulsar.apelido} sai da sala e não consegue voltar a ela.`}
          rotuloConfirmar="Expulsar"
          ocupado={ocupado}
          onConfirmar={confirmarExpulsao}
          onCancelar={() => definirParaExpulsar(null)}
        />
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Avisos } from './componentes/Avisos';
import { TelaCarregando } from './componentes/TelaCarregando';
import { cancelarRetomada, sairDaSala } from './estado/acoes';
import { useApp } from './estado/armazem';
import { TelaEntrada } from './features/entrada/TelaEntrada';
import { TelaLobby } from './features/lobby/TelaLobby';
import { TelaMesa } from './features/mesa/TelaMesa';
import { BalaoTutorial } from './features/tutorial/BalaoTutorial';

/**
 * No plano gratuito da Render o servidor dorme sem uso e leva até ~1 min para acordar. Depois
 * deste tempo sem conexão, o aviso passa a explicar a demora em vez de parecer travado.
 */
const ESPERA_ANTES_DE_EXPLICAR_MS = 4000;

function useDemorandoParaConectar(semConexao: boolean): boolean {
  const [demorando, definirDemorando] = useState(false);
  useEffect(() => {
    if (!semConexao) {
      definirDemorando(false);
      return;
    }
    const temporizador = setTimeout(() => definirDemorando(true), ESPERA_ANTES_DE_EXPLICAR_MS);
    return () => clearTimeout(temporizador);
  }, [semConexao]);
  return demorando;
}

function Rotas() {
  const app = useApp();

  // Early return por situação, da mais "global" para a mais específica.
  if (app.retomando) {
    return (
      <TelaCarregando
        mensagem="Retomando sua partida…"
        onCancelar={cancelarRetomada}
        rotuloCancelar="Começar do zero"
      />
    );
  }
  if (!app.sessao) return <TelaEntrada />;
  if (!app.sala) {
    return (
      <TelaCarregando
        mensagem="Entrando na sala…"
        onCancelar={() => void sairDaSala()}
        rotuloCancelar="Sair"
      />
    );
  }
  const encerradaNoLobby = app.jogo?.fase === 'encerrada' && app.voltouAoLobby;
  if (app.jogo && !encerradaNoLobby) return <TelaMesa />;
  return <TelaLobby />;
}

export function App() {
  const { conexao, sessao, tutorial } = useApp();
  // O tutorial roda sem servidor: a queda ou o cold start não devem aparecer no meio dele.
  const semConexao = conexao !== 'conectado' && tutorial === null;
  const demorando = useDemorandoParaConectar(semConexao);

  return (
    <div className="app">
      {semConexao && (
        <div className="aviso-conexao" role="status">
          {demorando
            ? 'Acordando o servidor… no plano gratuito isso pode levar até 1 minuto. Não feche a página.'
            : sessao
              ? 'Conexão perdida. Tentando reconectar…'
              : conexao === 'conectando'
                ? 'Conectando ao servidor…'
                : 'Sem conexão com o servidor. Tentando novamente…'}
        </div>
      )}
      <main className="conteudo">
        <Rotas />
      </main>
      <Avisos />
      {tutorial && <BalaoTutorial />}
    </div>
  );
}

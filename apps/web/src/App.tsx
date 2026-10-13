import { Avisos } from './componentes/Avisos';
import { BotaoTema } from './componentes/BotaoTema';
import { TelaCarregando } from './componentes/TelaCarregando';
import { cancelarRetomada, sairDaSala } from './estado/acoes';
import { useApp } from './estado/armazem';
import { TelaEntrada } from './features/entrada/TelaEntrada';
import { TelaLobby } from './features/lobby/TelaLobby';
import { TelaMesa } from './features/mesa/TelaMesa';

function IconeMarca() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 2c3 4 8 7 8 12a4.500 4.500 0 0 1-7.200 3.600c.2 1.800.9 3 2.200 4.400H9c1.300-1.400 2-2.600 2.200-4.400A4.500 4.500 0 0 1 4 14c0-5 5-8 8-12z" />
    </svg>
  );
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
  const { conexao, sessao } = useApp();
  const semConexao = conexao !== 'conectado';

  return (
    <div className="app">
      <header className="barra">
        <span className="barra__marca">
          <IconeMarca />
          Fodinha
        </span>
        <BotaoTema />
      </header>
      {semConexao && (
        <div className="aviso-conexao" role="status">
          {sessao
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
    </div>
  );
}

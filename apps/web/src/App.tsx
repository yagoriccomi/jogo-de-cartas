import { Avisos } from './componentes/Avisos';
import { TelaCarregando } from './componentes/TelaCarregando';
import { cancelarRetomada, sairDaSala } from './estado/acoes';
import { useApp } from './estado/armazem';
import { TelaEntrada } from './features/entrada/TelaEntrada';
import { TelaLobby } from './features/lobby/TelaLobby';
import { TelaMesa } from './features/mesa/TelaMesa';

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

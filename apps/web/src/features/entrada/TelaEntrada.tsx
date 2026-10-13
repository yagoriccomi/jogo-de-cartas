import { useState, type FormEvent } from 'react';
import { CONFIGURACAO_PADRAO, LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import { ConfiguracaoControles } from '../../componentes/ConfiguracaoControles';
import { criarSala, entrarNaSala } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { lerApelido, salvarApelido } from '../../lib/sessao';
import { useAcao } from '../../lib/useAcao';
import './entrada.css';

type Modo = 'criar' | 'entrar';

/** Lê o convite `/?sala=CODIGO` uma única vez, na abertura. */
function lerCodigoDoConvite(): string {
  return (new URLSearchParams(window.location.search).get('sala') ?? '').trim().toUpperCase();
}

function limparConviteDaUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

export function TelaEntrada() {
  const { conexao } = useApp();
  const [codigoConvite] = useState(lerCodigoDoConvite);
  const [modo, definirModo] = useState<Modo>(codigoConvite ? 'entrar' : 'criar');
  const [apelido, definirApelido] = useState(lerApelido);
  const [codigo, definirCodigo] = useState(codigoConvite);
  const [configuracao, definirConfiguracao] = useState<ConfiguracaoPartida>(CONFIGURACAO_PADRAO);
  const [tentou, definirTentou] = useState(false);
  const [ocupado, executar] = useAcao();

  const apelidoLimpo = apelido.trim();
  const codigoLimpo = codigo.trim().toUpperCase();
  const erroApelido = apelidoLimpo === '' ? 'Informe um apelido.' : null;
  const erroCodigo = modo === 'entrar' && codigoLimpo === '' ? 'Informe o código da sala.' : null;
  const semServidor = conexao !== 'conectado';

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    definirTentou(true);
    if (erroApelido || erroCodigo) return;

    void executar(async () => {
      const sucesso =
        modo === 'criar'
          ? await criarSala(apelidoLimpo, configuracao)
          : await entrarNaSala(codigoLimpo, apelidoLimpo);
      if (!sucesso) return;
      salvarApelido(apelidoLimpo);
      limparConviteDaUrl();
    });
  }

  return (
    <div className="entrada">
      <div className="entrada__titulo">
        <h1>Fodinha</h1>
        <p>Dê seu palpite, jogue suas cartas e sobreviva às vidas.</p>
      </div>

      <form className="cartao entrada__form" onSubmit={enviar} noValidate>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="apelido">
            Seu apelido
          </label>
          <input
            id="apelido"
            className="campo__entrada"
            value={apelido}
            maxLength={LIMITES.maxApelido}
            autoComplete="nickname"
            aria-invalid={tentou && erroApelido !== null}
            aria-describedby={tentou && erroApelido ? 'erro-apelido' : undefined}
            onChange={(e) => definirApelido(e.target.value)}
          />
          {tentou && erroApelido && (
            <span id="erro-apelido" className="campo__erro">
              {erroApelido}
            </span>
          )}
        </div>

        <div className="abas" role="tablist" aria-label="O que deseja fazer">
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'criar'}
            className="aba"
            onClick={() => definirModo('criar')}
          >
            Criar sala
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={modo === 'entrar'}
            className="aba"
            onClick={() => definirModo('entrar')}
          >
            Entrar com código
          </button>
        </div>

        {modo === 'criar' ? (
          <ConfiguracaoControles valor={configuracao} onChange={definirConfiguracao} />
        ) : (
          <div className="campo">
            <label className="campo__rotulo" htmlFor="codigo">
              Código da sala
            </label>
            <input
              id="codigo"
              className="campo__entrada entrada__codigo"
              value={codigo}
              maxLength={12}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={tentou && erroCodigo !== null}
              aria-describedby={tentou && erroCodigo ? 'erro-codigo' : undefined}
              onChange={(e) => definirCodigo(e.target.value.toUpperCase())}
            />
            {tentou && erroCodigo && (
              <span id="erro-codigo" className="campo__erro">
                {erroCodigo}
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          className="botao botao--primario botao--bloco"
          disabled={ocupado || semServidor}
        >
          {ocupado ? 'Aguarde…' : modo === 'criar' ? 'Criar sala' : 'Entrar na sala'}
        </button>
        {semServidor && (
          <p className="entrada__ajuda">Aguardando conexão com o servidor para continuar.</p>
        )}
      </form>
    </div>
  );
}

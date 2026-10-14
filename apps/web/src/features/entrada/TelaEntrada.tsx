import { useState, type FormEvent } from 'react';
import { CONFIGURACAO_PADRAO, LIMITES, type ConfiguracaoPartida } from '@fodinha/shared';
import { BotaoInstalar } from '../../componentes/BotaoInstalar';
import { ConfiguracaoControles } from '../../componentes/ConfiguracaoControles';
import { IconeFechar } from '../../componentes/Icones';
import { criarSala, dispensarAvisoDeEntrada, entrarNaSala } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
import { classes } from '../../lib/classes';
import { lerApelido, salvarApelido } from '../../lib/sessao';
import { useAcao } from '../../lib/useAcao';
import { Carta } from '../mesa/Carta';
import './entrada.css';

type Modo = 'criar' | 'entrar';

/** Quantidade máxima de caracteres do código de sala digitado. */
const MAX_CODIGO = 12;

/** Passos exibidos ao lado do formulário no computador. */
const PASSOS: readonly string[] = [
  'Palpite quantas vazas vai fazer.',
  'Errou? Perde uma vida por vaza de diferença.',
  'Último com vida vence a partida.',
];

/** Lê o convite `/?sala=CODIGO` uma única vez, na abertura. */
function lerCodigoDoConvite(): string {
  return (new URLSearchParams(window.location.search).get('sala') ?? '').trim().toUpperCase();
}

function limparConviteDaUrl(): void {
  window.history.replaceState(null, '', window.location.pathname);
}

export function TelaEntrada() {
  const { conexao, avisoEntrada } = useApp();
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
      <div className="entrada__apresentacao">
        <div className="entrada__leque" aria-hidden="true">
          <div className="entrada__carta entrada__carta--esquerda">
            <Carta carta={{ id: 'a', valor: '7', naipe: 'copas' }} manilha="A" />
          </div>
          <div className="entrada__carta entrada__carta--centro">
            <Carta carta={{ id: 'b', valor: 'A', naipe: 'espadas' }} manilha="A" />
          </div>
          <div className="entrada__carta entrada__carta--direita">
            <Carta carta={{ id: 'c', valor: '4', naipe: 'paus' }} manilha="A" />
          </div>
        </div>
        <h1 className="neon entrada__logo">Fodinha</h1>
        <p className="entrada__slogan">
          <span className="so-celular">Dê seu palpite. Sobreviva às vidas.</span>
          <span className="so-computador">
            O carteado de palpite com os amigos — online, no celular ou no computador.
          </span>
        </p>
        <ol className="entrada__passos">
          {PASSOS.map((passo, indice) => (
            <li key={passo}>
              <span className="entrada__passo-numero">{indice + 1}</span>
              <span>{passo}</span>
            </li>
          ))}
        </ol>
      </div>

      <form className="entrada__form" onSubmit={enviar} noValidate>
        {avisoEntrada && (
          <div className="entrada__aviso" role="alert">
            <span>{avisoEntrada}</span>
            <button
              type="button"
              className="botao botao--texto botao--icone"
              aria-label="Fechar aviso"
              onClick={dispensarAvisoDeEntrada}
            >
              <IconeFechar />
            </button>
          </div>
        )}

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

        <div className="abas" role="group" aria-label="O que deseja fazer">
          <button
            type="button"
            aria-pressed={modo === 'criar'}
            className={classes('aba', modo === 'criar' && 'aba--ativa')}
            onClick={() => definirModo('criar')}
          >
            Criar sala
          </button>
          <button
            type="button"
            aria-pressed={modo === 'entrar'}
            className={classes('aba', modo === 'entrar' && 'aba--ativa')}
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
              maxLength={MAX_CODIGO}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={tentou && erroCodigo !== null}
              aria-describedby={tentou && erroCodigo ? 'erro-codigo' : 'ajuda-codigo'}
              onChange={(e) => definirCodigo(e.target.value.toUpperCase())}
            />
            {tentou && erroCodigo ? (
              <span id="erro-codigo" className="campo__erro">
                {erroCodigo}
              </span>
            ) : (
              <span id="ajuda-codigo" className="entrada__ajuda">
                Recebeu um link de convite? O código já vem preenchido.
              </span>
            )}
          </div>
        )}

        <button
          type="submit"
          className="botao botao--primario botao--bloco"
          disabled={ocupado || semServidor}
        >
          {ocupado ? 'Aguarde…' : modo === 'criar' ? 'Criar sala' : 'Entrar na mesa'}
        </button>
        {semServidor && (
          <p className="entrada__ajuda" role="status">
            Aguardando conexão com o servidor para continuar.
          </p>
        )}

        <div className="entrada__instalar">
          <BotaoInstalar />
        </div>
      </form>
    </div>
  );
}

import { useState, type FormEvent } from 'react';
import { CONFIGURACAO_PADRAO, LIMITES } from '@fodinha/shared';
import { BotaoInstalar } from '../../componentes/BotaoInstalar';
import { IconeFechar, IconeLivro } from '../../componentes/Icones';
import { iniciarTutorial } from '../tutorial/motor';
import { criarSala, dispensarAvisoDeEntrada, entrarNaSala } from '../../estado/acoes';
import { useApp } from '../../estado/armazem';
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
  const [tentou, definirTentou] = useState(false);
  const [ocupado, executar] = useAcao();

  const apelidoLimpo = apelido.trim();
  const codigoLimpo = codigo.trim().toUpperCase();
  const erroApelido = apelidoLimpo === '' ? 'Informe um apelido.' : null;
  const erroCodigo = modo === 'entrar' && codigoLimpo === '' ? 'Informe o código da sala.' : null;
  const semServidor = conexao !== 'conectado';

  function trocarModo(novo: Modo) {
    definirModo(novo);
    definirTentou(false);
  }

  // A sala nasce com a configuração padrão; o dono ajusta no lobby, antes de iniciar.
  function enviar(evento: FormEvent) {
    evento.preventDefault();
    definirTentou(true);
    if (erroApelido || erroCodigo) return;

    void executar(async () => {
      const sucesso =
        modo === 'criar'
          ? await criarSala(apelidoLimpo, CONFIGURACAO_PADRAO)
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
            placeholder="Ex.: Yago"
            aria-invalid={tentou && erroApelido !== null}
            aria-describedby={tentou && erroApelido ? 'erro-apelido' : 'ajuda-apelido'}
            onChange={(e) => definirApelido(e.target.value)}
          />
          {tentou && erroApelido ? (
            <span id="erro-apelido" className="campo__erro">
              {erroApelido}
            </span>
          ) : (
            <span id="ajuda-apelido" className="entrada__ajuda">
              Sem cadastro: é só o nome na mesa.
            </span>
          )}
        </div>

        {modo === 'entrar' && (
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
        {modo === 'criar' ? (
          <button type="button" className="botao botao--bloco" onClick={() => trocarModo('entrar')}>
            Entrar com código
          </button>
        ) : (
          <button
            type="button"
            className="botao botao--texto entrada__trocar"
            onClick={() => trocarModo('criar')}
          >
            Criar uma sala nova
          </button>
        )}
        {semServidor && (
          <p className="entrada__ajuda" role="status">
            Aguardando conexão com o servidor para continuar.
          </p>
        )}

        {/* Não depende do servidor: dá para aprender enquanto ele acorda. */}
        <button
          type="button"
          className="botao botao--bloco entrada__tutorial"
          onClick={iniciarTutorial}
        >
          <IconeLivro className="icone" />
          Aprender a jogar (tutorial)
        </button>

        <div className="entrada__instalar">
          <BotaoInstalar />
        </div>
      </form>
    </div>
  );
}

import { useEffect, useState } from 'react';
import type { Carta as CartaDoJogo, Naipe, Valor } from '@fodinha/shared';
import { Coracoes } from '../../componentes/Coracoes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import { classes } from '../../lib/classes';
import { Carta } from '../mesa/Carta';
import { INTERVALO_DUPLO_CLIQUE_MS } from '../../lib/useDuploToque';
import { SimbolosMaoEPe } from '../mesa/SimbolosMaoEPe';

const LARGURA_PEQUENA = 36;
const LARGURA_MEDIA = 46;
const LARGURA_GRANDE = 56;

const VIDAS_DO_EXEMPLO = 5;
const VIDAS_PERDIDAS_NO_EXEMPLO = 2;
/** Espera antes de apagar os corações, para o jogador ver o "antes" e depois a perda. */
const ESPERA_PERDA_MS = 900;
const MS_POR_SEGUNDO = 1000;
/** Abertura do leque de cartas, em graus por carta. */
const GRAUS_POR_CARTA = 9;
const VALORES_DO_LEQUE: readonly Valor[] = ['7', 'Q', 'A'];

function cartaDe(valor: Valor, naipe: Naipe): CartaDoJogo {
  return { id: `${valor}-${naipe}`, valor, naipe };
}

/** Atraso de entrada escalonado: cada elemento da ilustração aparece logo após o anterior. */
function atraso(ordem: number): EstiloComVariaveis {
  return { '--ordem': ordem };
}

function Seta({ ordem }: { ordem: number }) {
  return (
    <span className="guia__seta guia__entra" style={atraso(ordem)} aria-hidden="true">
      ›
    </span>
  );
}

function Balao({ children, tom, ordem }: { children: string; tom?: 'bloqueado'; ordem: number }) {
  return (
    <span
      className={classes('guia__balao guia__entra', tom && `guia__balao--${tom}`)}
      style={atraso(ordem)}
    >
      {children}
    </span>
  );
}

/** Cartas em leque, para mostrar o tamanho da mão em cada rodada. */
function Leque({ quantidade, cega = false }: { quantidade: number; cega?: boolean }) {
  return (
    <span className="guia__leque">
      {Array.from({ length: quantidade }, (_, indice) => {
        const giro = (indice - (quantidade - 1) / 2) * GRAUS_POR_CARTA;
        const estilo: EstiloComVariaveis = { '--giro': `${giro}deg` };
        const valor = VALORES_DO_LEQUE[indice] ?? '4';
        return (
          <span key={indice} className="guia__leque-carta" style={estilo}>
            <Carta carta={cega ? null : cartaDe(valor, 'copas')} largura={LARGURA_PEQUENA} densa />
          </span>
        );
      })}
    </span>
  );
}

export function IlustracaoObjetivo() {
  return (
    <div className="guia__coluna">
      <div className="guia__linha-vidas guia__entra" style={atraso(0)}>
        <Coracoes
          vidas={VIDAS_DO_EXEMPLO}
          vidasIniciais={VIDAS_DO_EXEMPLO}
          className="guia__vidas"
        />
        <span className="guia__legenda">acertou tudo</span>
      </div>
      <div className="guia__linha-vidas guia__entra" style={atraso(1)}>
        <Coracoes vidas={2} vidasIniciais={VIDAS_DO_EXEMPLO} className="guia__vidas" />
        <span className="guia__legenda">errou demais</span>
      </div>
      <div className="guia__linha-vidas guia__entra" style={atraso(2)}>
        <Coracoes vidas={0} vidasIniciais={VIDAS_DO_EXEMPLO} className="guia__vidas" />
        <span className="guia__legenda">eliminado</span>
      </div>
    </div>
  );
}

export function IlustracaoRodadas() {
  return (
    <div className="guia__coluna">
      <div className="guia__linha">
        <div className="guia__rotulada guia__entra" style={atraso(0)}>
          <Leque quantidade={1} cega />
          <span className="guia__legenda guia__legenda--ciano">1 · cega</span>
        </div>
        <Seta ordem={1} />
        <div className="guia__rotulada guia__entra" style={atraso(2)}>
          <Leque quantidade={2} />
          <span className="guia__legenda">2</span>
        </div>
        <Seta ordem={3} />
        <div className="guia__rotulada guia__entra" style={atraso(4)}>
          <Leque quantidade={3} />
          <span className="guia__legenda">3</span>
        </div>
        <Seta ordem={5} />
        <div className="guia__rotulada guia__entra" style={atraso(6)}>
          <span className="guia__reticencias">…</span>
          <span className="guia__legenda">máx.</span>
        </div>
      </div>
      <span className="guia__pilula guia__entra" style={atraso(7)}>
        ↺ e volta a 1
      </span>
    </div>
  );
}

export function IlustracaoPalpite() {
  return (
    <div className="guia__linha guia__linha--topo">
      <div className="guia__jogador guia__entra" style={atraso(0)}>
        <SimbolosMaoEPe ehMao ehPe={false} />
        <span className="guia__nome">Ana</span>
        <Balao ordem={1}>1</Balao>
        <span className="guia__legenda guia__legenda--rosa">mão</span>
      </div>
      <Seta ordem={2} />
      <div className="guia__jogador guia__entra" style={atraso(3)}>
        <span className="guia__espaco-simbolo" />
        <span className="guia__nome">Bia</span>
        <Balao ordem={4}>0</Balao>
        <span className="guia__legenda">2º</span>
      </div>
      <Seta ordem={5} />
      <div className="guia__jogador guia__entra" style={atraso(6)}>
        <SimbolosMaoEPe ehMao={false} ehPe />
        <span className="guia__nome">Caio</span>
        <Balao ordem={7}>?</Balao>
        <span className="guia__legenda guia__legenda--ciano">pé</span>
      </div>
    </div>
  );
}

export function IlustracaoRegraDoPe() {
  return (
    <div className="guia__coluna">
      <span className="guia__legenda guia__entra" style={atraso(0)}>
        rodada de 3 cartas
      </span>
      <div className="guia__linha">
        <Balao ordem={1}>1</Balao>
        <span className="guia__operador guia__entra" style={atraso(2)}>
          +
        </span>
        <Balao ordem={3}>1</Balao>
        <span className="guia__operador guia__entra" style={atraso(4)}>
          +
        </span>
        <Balao ordem={5} tom="bloqueado">
          1
        </Balao>
        <span className="guia__operador guia__entra" style={atraso(6)}>
          =
        </span>
        <span className="guia__operador guia__operador--forte guia__entra" style={atraso(6)}>
          3
        </span>
      </div>
      <span className="guia__pilula guia__pilula--alerta guia__entra" style={atraso(7)}>
        soma ≠ 3 · o pé escolhe 0 ou 2
      </span>
    </div>
  );
}

const ORDEM_DAS_CARTAS: readonly CartaDoJogo[] = [
  cartaDe('4', 'ouros'),
  cartaDe('5', 'espadas'),
  cartaDe('6', 'copas'),
  cartaDe('7', 'paus'),
  cartaDe('Q', 'ouros'),
  cartaDe('J', 'espadas'),
  cartaDe('K', 'copas'),
  cartaDe('A', 'paus'),
  cartaDe('2', 'ouros'),
  cartaDe('3', 'espadas'),
];

export function IlustracaoForca() {
  return (
    <div className="guia__coluna">
      <div className="guia__grade-cartas">
        {ORDEM_DAS_CARTAS.map((carta, indice) => (
          <span key={carta.id} className="guia__entra" style={atraso(indice)}>
            <Carta carta={carta} largura={LARGURA_PEQUENA} />
          </span>
        ))}
      </div>
      <div className="guia__barra-forca guia__entra" style={atraso(ORDEM_DAS_CARTAS.length)}>
        <span>mais fraca</span>
        <span className="guia__barra-forca-linha" />
        <span>mais forte</span>
      </div>
    </div>
  );
}

const NAIPES_DA_MANILHA: readonly Naipe[] = ['paus', 'copas', 'espadas', 'ouros'];

export function IlustracaoManilha() {
  return (
    <div className="guia__coluna">
      <div className="guia__linha">
        <div className="guia__rotulada guia__entra" style={atraso(0)}>
          <Carta carta={cartaDe('J', 'espadas')} largura={LARGURA_MEDIA} rotulo="Vira" />
          <span className="guia__legenda">vira</span>
        </div>
        <Seta ordem={1} />
        <div className="guia__rotulada guia__entra" style={atraso(2)}>
          <Carta carta={cartaDe('K', 'paus')} manilha="K" largura={LARGURA_MEDIA} />
          <span className="guia__legenda guia__legenda--rosa">manilha!</span>
        </div>
      </div>
      <div className="guia__linha">
        {NAIPES_DA_MANILHA.map((naipe, indice) => (
          <div key={naipe} className="guia__rotulada guia__entra" style={atraso(indice + 3)}>
            <Carta carta={cartaDe('K', naipe)} manilha="K" largura={LARGURA_PEQUENA} />
            <span className="guia__legenda">
              {indice + 1}º {naipe}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function IlustracaoAnulacao() {
  return (
    <div className="guia__linha">
      <div className="guia__par-anulado guia__entra" style={atraso(0)}>
        <Carta carta={cartaDe('7', 'copas')} largura={LARGURA_MEDIA} estado="apagada" />
        <Carta carta={cartaDe('7', 'espadas')} largura={LARGURA_MEDIA} estado="apagada" />
        <span className="guia__risco" aria-hidden="true">
          ✕
        </span>
      </div>
      <Seta ordem={2} />
      <div className="guia__rotulada guia__vencedora guia__entra" style={atraso(3)}>
        <Carta carta={cartaDe('5', 'paus')} largura={LARGURA_GRANDE} />
        <span className="guia__legenda guia__legenda--dourado">leva a vaza!</span>
      </div>
    </div>
  );
}

export function IlustracaoVidas() {
  const [vidas, definirVidas] = useState(VIDAS_DO_EXEMPLO);

  // A perda acontece depois da entrada, para o piscar do coração apagando ser percebido.
  useEffect(() => {
    const espera = window.setTimeout(
      () => definirVidas(VIDAS_DO_EXEMPLO - VIDAS_PERDIDAS_NO_EXEMPLO),
      ESPERA_PERDA_MS,
    );
    return () => window.clearTimeout(espera);
  }, []);

  return (
    <div className="guia__coluna">
      <div className="guia__linha">
        <span className="guia__pilula guia__entra" style={atraso(0)}>
          pediu 2
        </span>
        <span className="guia__pilula guia__entra" style={atraso(1)}>
          fez 0
        </span>
      </div>
      <span className="guia__resultado guia__entra" style={atraso(2)}>
        −2 ❤
      </span>
      <div className="guia__entra" style={atraso(3)}>
        <Coracoes vidas={vidas} vidasIniciais={VIDAS_DO_EXEMPLO} className="guia__vidas" />
      </div>
    </div>
  );
}

export function IlustracaoTempo() {
  const intervalo = (INTERVALO_DUPLO_CLIQUE_MS / MS_POR_SEGUNDO).toLocaleString('pt-BR');
  return (
    <div className="guia__linha guia__linha--topo">
      <div className="guia__rotulada guia__tela guia__entra" style={atraso(0)}>
        <span className="guia__sobe">
          <Carta carta={cartaDe('A', 'copas')} largura={LARGURA_PEQUENA} estado="selecionada" />
        </span>
        <span className="guia__legenda">1 toque: escolhe</span>
      </div>
      <div className="guia__rotulada guia__tela guia__entra" style={atraso(1)}>
        <span className="guia__toque-duplo">2×</span>
        <span className="guia__legenda">em {intervalo} s: joga</span>
      </div>
      <div className="guia__rotulada guia__tela guia__entra" style={atraso(2)}>
        <span className="guia__relogio" aria-hidden="true">
          <span className="guia__relogio-barra" />
        </span>
        <span className="guia__legenda">acabou? joga por você</span>
      </div>
    </div>
  );
}

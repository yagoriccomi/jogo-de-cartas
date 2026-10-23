import type { JogadorVisivel, Valor } from '@fodinha/shared';
import { Coracoes } from '../../componentes/Coracoes';
import { IconeOlho } from '../../componentes/Icones';
import { classes } from '../../lib/classes';
import { CONSULTA_COMPUTADOR, useMediaQuery } from '../../lib/useMediaQuery';
import { MARCADORES } from './animacao-compartilhada';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';
import { Montinhos } from './Montinhos';
import { SeloBot } from './SeloBot';
import { NumerosDaRodada } from './NumerosDaRodada';
import { SimbolosMaoEPe } from './SimbolosMaoEPe';

/** Largura da carta "na testa" exibida na placa durante a rodada cega. */
const LARGURA_CARTA_NA_TESTA = 46;

interface Props {
  readonly jogador: JogadorVisivel;
  readonly vidasIniciais: number;
  readonly ehPe: boolean;
  readonly ehPrimeiro: boolean;
  /** Primeiro palpite da partida: os ícones de mão/pé vêm com o nome por extenso. */
  readonly rotularMaoEPe?: boolean;
  readonly ehDaVez: boolean;
  /** Instante local em que o prazo da vez acaba (só preenchido para o jogador da vez). */
  readonly prazoFinal: number | null;
  readonly manilha: Valor | null;
  /** "Fez" à vista: a vaza que ainda voa até aqui só conta ao pousar (`contagemVisivel`). */
  readonly feitasVisiveis: number;
  /** Montinhos à vista; os demais ficam reservados (invisíveis) como destino do voo. */
  readonly montesVisiveis: number;
  /** Só para quem foi eliminado, com a opção do dono ligada: abre a mão deste jogador. */
  readonly onVerMao?: () => void;
}

function descreverPlaca(jogador: JogadorVisivel): string {
  const partes = [jogador.apelido];
  if (jogador.eliminado) partes.push('eliminado');
  else {
    partes.push(jogador.palpite === null ? 'sem palpite' : `palpite ${jogador.palpite}`);
    partes.push(`fez ${jogador.vazasFeitas}`);
  }
  return partes.join(', ');
}

/**
 * Placa de um adversário: nome, selo de bot, mão/pé, corações de vida, palpite/fez e montinhos.
 * No celular as miniaturas dos montinhos não se leem: o "Fez" vira o destino do voo da vaza.
 */
export function PlacaJogador({
  jogador,
  vidasIniciais,
  ehPe,
  ehPrimeiro,
  rotularMaoEPe = false,
  ehDaVez,
  prazoFinal,
  manilha,
  feitasVisiveis,
  montesVisiveis,
  onVerMao,
}: Props) {
  const offline = !jogador.conectado && !jogador.ehBot;
  const computador = useMediaQuery(CONSULTA_COMPUTADOR);

  return (
    <li
      className={classes(
        'placa',
        ehDaVez && 'placa--vez',
        jogador.eliminado && 'placa--eliminada',
        offline && 'placa--offline',
        jogador.cartaNaTesta && 'placa--com-testa',
      )}
      aria-current={ehDaVez ? 'true' : undefined}
      aria-label={descreverPlaca(jogador)}
      {...{ [MARCADORES.placaDoJogador]: jogador.id }}
    >
      <div className="placa__linha">
        <div className="placa__texto">
          <span className="placa__nome">
            {jogador.ehBot && <SeloBot />}
            <span className="placa__apelido">{jogador.apelido}</span>
          </span>
          {jogador.eliminado && <span className="placa__nota">Eliminado</span>}
          {!jogador.eliminado && jogador.saiAoFimDaRodada && (
            <span className="placa__nota">bot terminando a rodada</span>
          )}
          {offline && !jogador.saiAoFimDaRodada && !jogador.eliminado && (
            <span className="placa__nota">Offline</span>
          )}
          {onVerMao && (
            <span className="placa__nota placa__dica-mao">
              <IconeOlho className="icone" />
              ver cartas
            </span>
          )}
          {ehDaVez && prazoFinal !== null && (
            <ContagemRegressiva prazoFinal={prazoFinal} className="placa__contagem" />
          )}
        </div>

        {jogador.cartaNaTesta && (
          <div className="placa__testa">
            <Carta
              carta={jogador.cartaNaTesta}
              manilha={manilha}
              largura={LARGURA_CARTA_NA_TESTA}
              densa
              rotulo={`Testa de ${jogador.apelido}`}
            />
          </div>
        )}
      </div>

      <Coracoes vidas={jogador.vidas} vidasIniciais={vidasIniciais} className="placa__vidas" />

      {!jogador.eliminado && (
        <NumerosDaRodada
          palpite={jogador.palpite}
          feitas={feitasVisiveis}
          destinoDoMonte={computador ? undefined : jogador.id}
          className="numeros--placa"
        />
      )}

      {computador && (
        <Montinhos
          jogadorId={jogador.id}
          vazas={jogador.vazasGanhas}
          manilha={manilha}
          visiveis={montesVisiveis}
          className="montes--placa"
        />
      )}

      <SimbolosMaoEPe
        ehMao={ehPrimeiro}
        ehPe={ehPe}
        comRotulo={rotularMaoEPe}
        className="simbolos--placa"
      />

      {onVerMao && (
        <button
          type="button"
          className="placa__ver-mao"
          aria-label={`Ver as cartas de ${jogador.apelido}`}
          onClick={onVerMao}
        />
      )}
    </li>
  );
}

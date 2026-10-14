import type { JogadorVisivel, Valor } from '@fodinha/shared';
import { Coracoes } from '../../componentes/Coracoes';
import { classes } from '../../lib/classes';
import { MARCADORES } from './animacao-compartilhada';
import { Carta } from './Carta';
import { ContagemRegressiva } from './ContagemRegressiva';
import { Montinhos } from './Montinhos';

/** Largura da carta "na testa" exibida na placa durante a rodada cega. */
const LARGURA_CARTA_NA_TESTA = 46;

interface Props {
  readonly jogador: JogadorVisivel;
  readonly vidasIniciais: number;
  readonly ehPe: boolean;
  readonly ehPrimeiro: boolean;
  readonly ehDaVez: boolean;
  /** Instante local em que o prazo da vez acaba (só preenchido para o jogador da vez). */
  readonly prazoFinal: number | null;
  readonly manilha: Valor | null;
  /** O montinho mais novo ainda está a caminho (animação da vaza): não mostrá-lo antes. */
  readonly ocultarUltimoMonte: boolean;
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

/** Placa de um adversário: nome, selos (PÉ, bot), corações de vida, fez/palpite e montinhos de vazas. */
export function PlacaJogador({
  jogador,
  vidasIniciais,
  ehPe,
  ehPrimeiro,
  ehDaVez,
  prazoFinal,
  manilha,
  ocultarUltimoMonte,
}: Props) {
  const offline = !jogador.conectado && !jogador.ehBot;

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
            <span className="placa__apelido">{jogador.apelido}</span>
            {ehPe && <span className="selo selo--pe">Pé</span>}
            {jogador.ehBot && <span className="selo so-computador">Bot</span>}
          </span>
          {!jogador.eliminado && (
            <span className="placa__detalhe so-computador">
              {jogador.cartasNaMao} {jogador.cartasNaMao === 1 ? 'carta' : 'cartas'}
            </span>
          )}
          {jogador.eliminado && <span className="placa__nota">Eliminado</span>}
          {!jogador.eliminado && jogador.saiAoFimDaRodada && (
            <span className="placa__nota">bot terminando a rodada</span>
          )}
          {offline && !jogador.saiAoFimDaRodada && !jogador.eliminado && (
            <span className="placa__nota">Offline</span>
          )}
          {ehDaVez && prazoFinal !== null && (
            <ContagemRegressiva prazoFinal={prazoFinal} className="placa__contagem" />
          )}
        </div>

        {!jogador.eliminado && (
          <div className="placa__placar" aria-hidden="true">
            <span className="placa__numero">
              {jogador.vazasFeitas}
              <span className="placa__barra">/</span>
              {jogador.palpite ?? '–'}
            </span>
            <span className="placa__legenda">fez / palpite</span>
          </div>
        )}

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

      <Montinhos
        jogadorId={jogador.id}
        vazas={jogador.vazasGanhas}
        manilha={manilha}
        ocultarUltimo={ocultarUltimoMonte}
        className="montes--placa"
      />

      {ehPrimeiro && (
        <span className="ficha-primeiro" role="img" aria-label="Abre a rodada">
          1º
        </span>
      )}
    </li>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { EstadoPartidaVisivel } from '@fodinha/shared';
import { Dialogo } from '../../componentes/Dialogo';
import { lerRegras, pararDeLerRegras } from '../../estado/acoes';
import { useAgora } from '../../lib/useAgora';
import { formatarDuracao } from '../mesa/tempo';
import './regras.css';
import { verboDeToque } from '../tutorial/ponteiro';
import { dispensarResumo, resumoDispensado } from './preferencia';

const INTERVALO_RELOGIO_MS = 1000;

interface Props {
  readonly jogo: EstadoPartidaVisivel;
  readonly meuId: string;
  readonly recebidoEm: number;
  /** Só quem está jogando de verdade (fora do tutorial e não eliminado) pausa a mesa para ler. */
  readonly ativo: boolean;
}

/**
 * Resumo das regras no começo da partida, enquanto o jogador não pedir para não ver mais. Aberto,
 * pede ao servidor que pause a mesa; o servidor encerra a pausa sozinho no limite de tempo.
 */
export function ResumoDasRegras({ jogo, meuId, recebidoEm, ativo }: Props) {
  const [aberto, definirAberto] = useState(false);
  const jaAbriu = useRef(false);
  const pausaConfirmada = useRef(false);
  const agora = useAgora(INTERVALO_RELOGIO_MS);
  const inicioDaPartida = jogo.numeroRodada === 1 && jogo.fase === 'palpites';
  const minhaLeitura = jogo.pausa?.lendoRegras?.jogadorId === meuId ? jogo.pausa.lendoRegras : null;
  const estouLendo = minhaLeitura !== null;

  useEffect(() => {
    // Fora do começo, rearma: um reinício da sala volta à rodada 1 e mostra o resumo de novo.
    if (!inicioDaPartida) {
      jaAbriu.current = false;
      return;
    }
    if (jaAbriu.current || !ativo || resumoDispensado()) return;
    jaAbriu.current = true;
    definirAberto(true);
    void lerRegras();
  }, [inicioDaPartida, ativo]);

  // O tempo da leitura acabou no servidor: a mesa voltou a andar, então o resumo sai da frente.
  useEffect(() => {
    if (estouLendo) {
      pausaConfirmada.current = true;
      return;
    }
    if (!pausaConfirmada.current) return;
    pausaConfirmada.current = false;
    definirAberto(false);
  }, [estouLendo]);

  if (!aberto) return null;

  function fechar(naoPerguntarMais: boolean) {
    if (naoPerguntarMais) dispensarResumo();
    definirAberto(false);
    void pararDeLerRegras();
  }

  const verbo = verboDeToque();
  return (
    <Dialogo idTitulo="titulo-resumo" onFechar={() => fechar(false)}>
      <h2 id="titulo-resumo" className="neon neon--ciano dialogo__titulo">
        Regras em 1 minuto
      </h2>
      {minhaLeitura && (
        <p className="resumo__espera" role="status">
          Mesa pausada esperando você:{' '}
          <strong>{formatarDuracao(recebidoEm + minhaLeitura.restanteMs - agora)}</strong>
        </p>
      )}
      <ul className="resumo__lista">
        <li>
          <strong>Palpite:</strong> diga quantas vazas vai fazer. Cada vaza de diferença custa 1
          vida; sem vidas, você sai.
        </li>
        <li>
          <strong>Rodadas:</strong> começam com 1 carta, sobem até o máximo e voltam a 1. Com 1
          carta você vê a dos outros, mas não a sua.
        </li>
        <li>
          <strong>Força:</strong> a manilha (o valor logo acima da vira) vence tudo. Cartas iguais
          se anulam.
        </li>
        <li>
          <strong>Pé:</strong> o último a palpitar não pode fazer a soma dos palpites dar o número
          de cartas.
        </li>
        <li>
          <strong>{verbo} 1× escolhe, 2× confirma:</strong> vale para carta, palpite e reação.
        </li>
      </ul>
      <p className="resumo__guia">O guia completo fica em Regras, no topo da mesa.</p>
      <div className="resumo__acoes">
        <button
          type="button"
          className="botao botao--primario botao--bloco"
          onClick={() => fechar(false)}
        >
          Entendi, vamos jogar
        </button>
        <button type="button" className="botao botao--texto" onClick={() => fechar(true)}>
          Não perguntar novamente neste computador
        </button>
      </div>
    </Dialogo>
  );
}

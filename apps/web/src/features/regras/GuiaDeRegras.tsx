import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react';
import { classes } from '../../lib/classes';
import { SLIDES } from './slides';
import './regras.css';

/** Deslize mínimo (px) para virar de slide: abaixo disso é só um toque ou rolagem. */
const DESLIZE_MINIMO_PX = 48;
const ULTIMO_SLIDE = SLIDES.length - 1;

interface Props {
  readonly onFechar: () => void;
}

interface PontoDeToque {
  readonly x: number;
  readonly y: number;
}

/** Guia ilustrado das regras: um slide por regra, com pontos, botões, setas do teclado e deslize. */
export function GuiaDeRegras({ onFechar }: Props) {
  const [indice, definirIndice] = useState(0);
  // Sentido da última troca: define de que lado o novo slide entra.
  const sentido = useRef<'avanca' | 'volta'>('avanca');
  const inicioDoToque = useRef<PontoDeToque | null>(null);

  const irPara = useCallback(
    (destino: number) => {
      const limitado = Math.min(Math.max(destino, 0), ULTIMO_SLIDE);
      if (limitado === indice) return;
      sentido.current = limitado > indice ? 'avanca' : 'volta';
      definirIndice(limitado);
    },
    [indice],
  );

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key === 'ArrowRight') irPara(indice + 1);
      else if (evento.key === 'ArrowLeft') irPara(indice - 1);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [indice, irPara]);

  function aoComecarToque(evento: TouchEvent) {
    const toque = evento.touches[0];
    inicioDoToque.current = toque ? { x: toque.clientX, y: toque.clientY } : null;
  }

  function aoTerminarToque(evento: TouchEvent) {
    const inicio = inicioDoToque.current;
    const toque = evento.changedTouches[0];
    inicioDoToque.current = null;
    if (!inicio || !toque) return;
    const dx = toque.clientX - inicio.x;
    const dy = toque.clientY - inicio.y;
    // Gesto mais vertical que horizontal é rolagem, não troca de slide.
    if (Math.abs(dx) < DESLIZE_MINIMO_PX || Math.abs(dx) < Math.abs(dy)) return;
    irPara(dx < 0 ? indice + 1 : indice - 1);
  }

  const slide = SLIDES[indice];
  if (!slide) return null;
  const ehUltimo = indice === ULTIMO_SLIDE;

  return (
    <div className="guia">
      <div
        className="guia__area"
        onTouchStart={aoComecarToque}
        onTouchEnd={aoTerminarToque}
        aria-live="polite"
      >
        <div
          key={slide.id}
          className={classes('guia__slide', sentido.current === 'volta' && 'guia__slide--volta')}
        >
          <div className="guia__palco">{slide.ilustracao}</div>
          <h3 className="neon guia__titulo">{slide.titulo}</h3>
          <p className="guia__texto">{slide.texto}</p>
        </div>
      </div>

      <div className="guia__pontos">
        {SLIDES.map((item, posicao) => (
          <button
            key={item.id}
            type="button"
            className={classes('guia__ponto', posicao === indice && 'guia__ponto--ativo')}
            aria-label={`Regra ${posicao + 1} de ${SLIDES.length}: ${item.titulo}`}
            aria-current={posicao === indice ? 'step' : undefined}
            onClick={() => irPara(posicao)}
          />
        ))}
      </div>

      <div className="guia__navegacao">
        <button
          type="button"
          className="botao"
          disabled={indice === 0}
          onClick={() => irPara(indice - 1)}
        >
          Anterior
        </button>
        {ehUltimo ? (
          <button type="button" className="botao botao--primario" onClick={onFechar}>
            Jogar!
          </button>
        ) : (
          <button
            type="button"
            className="botao botao--primario"
            onClick={() => irPara(indice + 1)}
          >
            Próxima
          </button>
        )}
      </div>
    </div>
  );
}

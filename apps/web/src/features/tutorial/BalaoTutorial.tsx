import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useApp } from '../../estado/armazem';
import { classes } from '../../lib/classes';
import type { EstiloComVariaveis } from '../../lib/estiloComVariaveis';
import {
  avancarTutorial,
  avancarTutorialRapido,
  encerrarTutorial,
  passoAtual,
  totalDePassos,
} from './motor';
import { ALVOS, seletorDeAlvo } from '../mesa/alvos';
import { verboDeToque } from './ponteiro';
import type { Espera } from './roteiro';
import './tutorial.css';

/** Folga entre o alvo e o anel de destaque, e entre o alvo e o balão. */
const FOLGA_DO_DESTAQUE_PX = 6;
const DISTANCIA_DO_BALAO_PX = 16;
/** Distância mínima do balão até as bordas da tela. */
const MARGEM_DA_TELA_PX = 12;
/** A seta não chega nos cantos arredondados do balão. */
const MARGEM_DA_SETA_PX = 22;
/** As cartas da mão: o jogador precisa vê-las para decidir o palpite. */
const SELETOR_DA_MAO = seletorDeAlvo(ALVOS.lequeDaMao);
/** Cobrir mais que isso da mão faz o balão trocar de lado, se couber no outro. */
const COBERTURA_TOLERADA_DA_MAO = 0.25;

interface Medida {
  readonly topo: number;
  readonly esquerda: number;
  readonly largura: number;
  readonly altura: number;
}

/** Primeiro alvo visível da lista (ex.: a alça no celular, os botões do topo no computador). */
function medirAlvo(seletor: string): Medida | null {
  for (const parte of seletor.split(',')) {
    const elemento = document.querySelector(parte.trim());
    if (!elemento) continue;
    const r = elemento.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) {
      return { topo: r.top, esquerda: r.left, largura: r.width, altura: r.height };
    }
  }
  return null;
}

function mesmaMedida(a: Medida | null, b: Medida | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    Math.abs(a.topo - b.topo) < 1 &&
    Math.abs(a.esquerda - b.esquerda) < 1 &&
    Math.abs(a.largura - b.largura) < 1 &&
    Math.abs(a.altura - b.altura) < 1
  );
}

/** Acompanha o alvo a cada quadro: a mesa anima (cartas voando, painel abrindo) o tempo todo. */
function useMedidaDoAlvo(seletor: string | null): Medida | null {
  const [medida, definirMedida] = useState<Medida | null>(null);
  useEffect(() => {
    if (seletor === null) {
      definirMedida(null);
      return;
    }
    let quadro = 0;
    const medir = () => {
      const nova = medirAlvo(seletor);
      definirMedida((atual) => (mesmaMedida(atual, nova) ? atual : nova));
      quadro = requestAnimationFrame(medir);
    };
    medir();
    return () => cancelAnimationFrame(quadro);
  }, [seletor]);
  return medida;
}

function dicaDaEspera(espera: Espera): string | null {
  if (espera.tipo === 'palpite') return `Escolha ${espera.valor} e confirme`;
  if (espera.tipo === 'jogar') return `${verboDeToque()} duas vezes na carta`;
  return null;
}

interface Posicao {
  readonly topo: number;
  readonly esquerda: number;
  readonly seta: number;
  readonly lado: 'acima' | 'abaixo';
}

type Lado = Posicao['lado'];

function topoNoLado(lado: Lado, alvo: Medida, alturaDoBalao: number): number {
  const topoDesejado =
    lado === 'abaixo'
      ? alvo.topo + alvo.altura + DISTANCIA_DO_BALAO_PX
      : alvo.topo - DISTANCIA_DO_BALAO_PX - alturaDoBalao;
  return Math.min(
    Math.max(topoDesejado, MARGEM_DA_TELA_PX),
    window.innerHeight - alturaDoBalao - MARGEM_DA_TELA_PX,
  );
}

/** Fração da altura da mão que o balão cobriria nesse topo (0 quando não há mão na tela). */
function coberturaDaMao(topo: number, alturaDoBalao: number, mao: Medida | null): number {
  if (mao === null) return 0;
  const sobreposicao =
    Math.min(topo + alturaDoBalao, mao.topo + mao.altura) - Math.max(topo, mao.topo);
  return Math.max(sobreposicao, 0) / mao.altura;
}

/**
 * Lado com mais espaço (acima ou abaixo do alvo), centralizado nele e preso dentro da tela. No
 * celular o balão preso na borda acabava em cima das cartas: se o outro lado esconde menos a mão,
 * ele vai para lá (exceto quando o alvo é a própria mão).
 */
function posicionar(alvo: Medida, balao: { largura: number; altura: number }): Posicao {
  const espacoAcima = alvo.topo;
  const espacoAbaixo = window.innerHeight - (alvo.topo + alvo.altura);
  const preferido: Lado =
    espacoAbaixo >= balao.altura + DISTANCIA_DO_BALAO_PX || espacoAbaixo >= espacoAcima
      ? 'abaixo'
      : 'acima';
  const outro: Lado = preferido === 'abaixo' ? 'acima' : 'abaixo';
  const medidaDaMao = medirAlvo(SELETOR_DA_MAO);
  const alvoNaMao = medidaDaMao !== null && alvo.topo >= medidaDaMao.topo;
  const mao = alvoNaMao ? null : medidaDaMao;
  const coberturaPreferida = coberturaDaMao(
    topoNoLado(preferido, alvo, balao.altura),
    balao.altura,
    mao,
  );
  const coberturaOutra = coberturaDaMao(topoNoLado(outro, alvo, balao.altura), balao.altura, mao);
  const lado =
    coberturaPreferida > COBERTURA_TOLERADA_DA_MAO && coberturaOutra < coberturaPreferida
      ? outro
      : preferido;
  const topo = topoNoLado(lado, alvo, balao.altura);
  const centroDoAlvo = alvo.esquerda + alvo.largura / 2;
  const esquerda = Math.min(
    Math.max(centroDoAlvo - balao.largura / 2, MARGEM_DA_TELA_PX),
    window.innerWidth - balao.largura - MARGEM_DA_TELA_PX,
  );
  const seta = Math.min(
    Math.max(centroDoAlvo - esquerda, MARGEM_DA_SETA_PX),
    balao.largura - MARGEM_DA_SETA_PX,
  );
  return { topo, esquerda, seta, lado };
}

/**
 * Balão de fala do tutorial: destaca o que está sendo explicado (anel neon e o resto da tela
 * escurecido) e aponta para ele. O destaque não bloqueia toques: dá para jogar a carta indicada.
 */
export function BalaoTutorial() {
  const { fonte } = useApp();
  const tutorial = fonte.origem === 'tutorial' ? fonte : null;
  const passo = tutorial === null ? null : passoAtual();
  const seletor = passo?.balao?.alvo ?? null;
  const alvo = useMedidaDoAlvo(seletor);
  const balaoRef = useRef<HTMLDivElement>(null);
  const [posicao, definirPosicao] = useState<Posicao | null>(null);

  useLayoutEffect(() => {
    const elemento = balaoRef.current;
    if (!elemento || alvo === null) {
      definirPosicao(null);
      return;
    }
    definirPosicao(
      posicionar(alvo, { largura: elemento.offsetWidth, altura: elemento.offsetHeight }),
    );
  }, [alvo, passo]);

  if (tutorial === null || passo === null || passo.balao === null) return null;
  // Alvo ainda não está na tela (ex.: painel que abre depois de uma animação): espera aparecer.
  const esperandoAlvo = seletor !== null && alvo === null;
  if (esperandoAlvo) return null;

  const { balao, espera } = passo;
  const centralizado = seletor === null;
  const dica = dicaDaEspera(espera);
  const estiloBalao: EstiloComVariaveis =
    posicao === null
      ? {}
      : { top: posicao.topo, left: posicao.esquerda, '--seta': `${posicao.seta}px` };

  return (
    <div className="tutorial" aria-live="polite">
      {alvo ? (
        <div
          className="tutorial__destaque"
          style={{
            top: alvo.topo - FOLGA_DO_DESTAQUE_PX,
            left: alvo.esquerda - FOLGA_DO_DESTAQUE_PX,
            width: alvo.largura + FOLGA_DO_DESTAQUE_PX * 2,
            height: alvo.altura + FOLGA_DO_DESTAQUE_PX * 2,
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="tutorial__veu" aria-hidden="true" />
      )}

      <div
        ref={balaoRef}
        key={tutorial.passo}
        className={classes(
          'tutorial__balao',
          centralizado && 'tutorial__balao--centro',
          posicao && `tutorial__balao--${posicao.lado}`,
          !centralizado && posicao === null && 'tutorial__balao--medindo',
        )}
        style={estiloBalao}
        role="dialog"
        aria-label="Tutorial"
      >
        <div className="tutorial__topo">
          <span className="tutorial__progresso">
            {tutorial.passo + 1}/{totalDePassos()}
          </span>
          <button type="button" className="tutorial__pular" onClick={encerrarTutorial}>
            Sair do tutorial
          </button>
        </div>
        {balao.titulo && <h2 className="neon tutorial__titulo">{balao.titulo}</h2>}
        <p className="tutorial__texto">{balao.texto}</p>
        {espera.tipo === 'botao' && (
          <div className="tutorial__botoes">
            {espera.atalho && (
              <button
                type="button"
                className="botao tutorial__proximo"
                onClick={avancarTutorialRapido}
              >
                {espera.atalho}
              </button>
            )}
            <button
              type="button"
              className="botao botao--primario tutorial__proximo"
              onClick={avancarTutorial}
            >
              {espera.rotulo ?? 'Próximo'}
            </button>
          </div>
        )}
        {dica && <p className="tutorial__dica">👉 {dica}</p>}
      </div>
    </div>
  );
}

import { expect, type Locator, type Page } from '@playwright/test';

/** Mesa cheia: 10 jogadores e 13 cartas na mão (o caso que mais aperta o layout). */
export const MESA_CHEIA = { jogadores: 10, cartas: 13 } as const;

/** Tolerância de arredondamento de subpixel nas medidas do navegador. */
const FOLGA_PX = 1;
/** Abaixo disso um botão de palpite fica difícil de acertar com o dedo. */
export const ALTURA_MINIMA_DO_BOTAO_PX = 32;
/** Bots demoram ~0,1 s nos testes, mas a mesa inteira (palpites + voos) leva alguns segundos. */
export const ESPERA_DA_MESA_MS = 45_000;

export interface Retangulo {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** Abre o cenário de teste de desenvolvimento: você + bots, já na rodada pedida. */
export async function abrirCenario(
  page: Page,
  { jogadores, cartas }: { jogadores: number; cartas: number } = MESA_CHEIA,
): Promise<void> {
  await page.goto(`/?cenario=${jogadores}x${cartas}`);
  await expect(page.locator('.mesa')).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
}

export async function medir(locator: Locator): Promise<Retangulo> {
  const caixa = await locator.boundingBox();
  if (caixa === null) throw new Error('Elemento sem caixa (não está visível).');
  return caixa;
}

export function contem(fora: Retangulo, dentro: Retangulo): boolean {
  return (
    dentro.x >= fora.x - FOLGA_PX &&
    dentro.y >= fora.y - FOLGA_PX &&
    dentro.x + dentro.width <= fora.x + fora.width + FOLGA_PX &&
    dentro.y + dentro.height <= fora.y + fora.height + FOLGA_PX
  );
}

/** Menor distância entre as bordas de dois retângulos (0 quando se tocam ou se cruzam). */
export function distancia(a: Retangulo, b: Retangulo): number {
  const dx = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width));
  const dy = Math.max(0, b.y - (a.y + a.height), a.y - (b.y + b.height));
  return Math.hypot(dx, dy);
}

export function telaDe(page: Page): Retangulo {
  const tamanho = page.viewportSize();
  if (tamanho === null) throw new Error('Viewport não definido.');
  return { x: 0, y: 0, ...tamanho };
}

/** Regra da casa: durante o jogo a página nunca rola, nem na vertical nem na horizontal. */
export async function esperarSemRolagem(page: Page): Promise<void> {
  const medidas = await page.evaluate(() => ({
    altura: document.documentElement.scrollHeight,
    largura: document.documentElement.scrollWidth,
    janelaAltura: window.innerHeight,
    janelaLargura: window.innerWidth,
  }));
  expect(medidas.altura, 'a página não pode rolar na vertical').toBeLessThanOrEqual(
    medidas.janelaAltura + FOLGA_PX,
  );
  expect(medidas.largura, 'a página não pode rolar na horizontal').toBeLessThanOrEqual(
    medidas.janelaLargura + FOLGA_PX,
  );
}

/** Palpita com a primeira opção liberada (o pé tem uma bloqueada). */
export async function palpitarQualquerCoisa(page: Page): Promise<void> {
  await page.locator('.palpite__opcao:not([disabled])').first().click();
  await page.locator('.palpite__rodape .botao').click();
  // Enquanto o servidor confirma, os botões ficam desabilitados: espera o painel fechar.
  await expect(page.locator('.palpite')).toBeHidden({ timeout: ESPERA_DA_MESA_MS });
}

/**
 * Joga a carta mais fraca quando for a sua vez, até a mesa ter `quantas` cartas. Assim a mesa
 * enche sem depender de em que assento você caiu.
 */
export async function jogarAteAMesaTer(page: Page, quantas: number): Promise<void> {
  const prazo = Date.now() + ESPERA_DA_MESA_MS;
  while (Date.now() < prazo) {
    if ((await page.locator('[data-carta-mesa]').count()) >= quantas) return;
    if (await page.locator('.palpite').isVisible()) await palpitarQualquerCoisa(page);
    const minhaVez = await page.locator('.vez--minha').isVisible();
    if (minhaVez && !(await page.locator('.palpite').isVisible())) {
      await page.locator('.mao__posicao .carta').last().dblclick();
    }
    await page.waitForTimeout(250);
  }
  throw new Error(`A mesa não chegou a ${quantas} cartas a tempo.`);
}

/** Espera as animações finitas (voos de carta, painéis) terminarem; pulsos neon são infinitos. */
export async function esperarAnimacoes(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document
      .getAnimations()
      .filter((animacao) => animacao.effect?.getTiming().iterations !== Infinity)
      .every((animacao) => animacao.playState !== 'running'),
  );
}

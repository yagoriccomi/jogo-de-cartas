import { expect, test, type Page } from '@playwright/test';
import { contem, esperarAnimacoes, medir, telaDe } from './apoio';

/** Generoso: alguns passos esperam o tempo de leitura das jogadas dos bots (~2,6 s). */
const ESPERA_DO_PASSO_MS = 15_000;
/** O roteiro tem menos que isso; o limite só evita laço infinito se algo travar. */
const MAXIMO_DE_PASSOS = 60;
/** Tolerância para achar a carta da mão sob o anel de destaque (as do leque são giradas). */
const TOLERANCIA_DO_CENTRO_PX = 24;

async function lerProgresso(page: Page): Promise<string> {
  return (await page.locator('.tutorial__progresso').textContent()) ?? '';
}

/** Joga a carta da mão que está sob o anel de destaque do balão. */
async function jogarCartaDestacada(page: Page): Promise<void> {
  const destaque = await medir(page.locator('.tutorial__destaque'));
  const centroX = destaque.x + destaque.width / 2;
  for (const carta of await page.locator('[data-carta-mao]').all()) {
    const caixa = await carta.boundingBox();
    if (caixa === null) continue;
    if (Math.abs(caixa.x + caixa.width / 2 - centroX) < TOLERANCIA_DO_CENTRO_PX) {
      await carta.dblclick();
      return;
    }
  }
  throw new Error('Nenhuma carta da mão sob o destaque do tutorial.');
}

test('o tutorial vai do começo ao fim com todo balão apontando para algo visível', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /aprender a jogar/i }).click();

  const balao = page.locator('.tutorial__balao:not(.tutorial__balao--medindo)');
  let passosVistos = 0;
  while (passosVistos < MAXIMO_DE_PASSOS) {
    // O balão só aparece quando acha o alvo: alvo quebrado (seletor velho) trava aqui.
    await expect(balao, 'balão do tutorial sem alvo na tela').toBeVisible({
      timeout: ESPERA_DO_PASSO_MS,
    });
    await esperarAnimacoes(page);
    const progresso = await lerProgresso(page);
    expect(
      contem(telaDe(page), await medir(balao)),
      `balão fora da tela no passo ${progresso}`,
    ).toBe(true);
    passosVistos += 1;

    const proximo = page.locator('.tutorial__proximo.botao--primario');
    if (await proximo.isVisible()) {
      const ultimo = (await proximo.textContent())?.includes('Jogar de verdade') ?? false;
      await proximo.click();
      if (ultimo) break;
    } else if (await page.locator('.palpite').isVisible()) {
      // O balão diz qual palpite o roteiro espera ("Escolha 2 e confirme").
      const dica = (await balao.locator('.tutorial__dica').textContent()) ?? '';
      const pedido = /Escolha (\d+)/.exec(dica)?.[1];
      if (pedido === undefined) throw new Error(`Passo de palpite sem número na dica: "${dica}"`);
      await page.locator('.palpite__opcao', { hasText: new RegExp(`^${pedido}$`) }).click();
      await page.locator('.palpite__rodape .botao').click();
    } else if ((await balao.locator('.tutorial__dica', { hasText: 'duas vezes' }).count()) > 0) {
      await jogarCartaDestacada(page);
    }
    // Passos de "tempo" (vez dos bots) avançam sozinhos; os outros, pela ação acima.
    await expect
      .poll(() => lerProgresso(page), { timeout: ESPERA_DO_PASSO_MS })
      .not.toBe(progresso);
  }

  await expect(page.locator('.entrada'), 'o tutorial termina na tela inicial').toBeVisible();
  expect(passosVistos).toBeGreaterThan(20);
});

test('a versão rápida pula os passos só explicativos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /aprender a jogar/i }).click();
  const progresso = page.locator('.tutorial__progresso');
  await expect(progresso).toBeVisible();
  const totalCompleto = Number((await lerProgresso(page)).split('/')[1]);

  await page.getByRole('button', { name: 'Versão rápida' }).click();

  await expect
    .poll(async () => Number((await lerProgresso(page)).split('/')[1]))
    .toBeLessThan(totalCompleto);
});

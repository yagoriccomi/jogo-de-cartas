import { expect, test } from '@playwright/test';

test('a tela inicial não vaza para os lados e oferece o tutorial', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.entrada')).toBeVisible();
  const vazamento = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(vazamento, 'rolagem horizontal na tela inicial').toBeLessThanOrEqual(1);
  await expect(page.getByRole('button', { name: /aprender a jogar/i })).toBeVisible();
});

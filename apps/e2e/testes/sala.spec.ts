import { expect, test, type Page } from '@playwright/test';
import { contem, dispensarResumoDasRegras, ESPERA_DA_MESA_MS, medir, telaDe } from './apoio';

/** O tempo da leitura que sobra, como o aviso mostra ("0:59"). */
const TEMPO_RESTANTE = /^\d+:\d{2}$/;

/** Cria uma sala nova ou, com o código, entra nela pelo link de convite. */
async function sentarNaSala(page: Page, apelido: string, codigo?: string): Promise<void> {
  await page.goto(codigo === undefined ? '/' : `/?sala=${codigo}`);
  await page.getByLabel('Seu apelido').fill(apelido);
  const botao = codigo === undefined ? 'Criar sala' : 'Entrar na mesa';
  await page.getByRole('button', { name: botao }).click();
}

test.describe('Sala com dois navegadores', () => {
  test('quem espera vê o novato lendo as regras, e a mesa volta quando ele fecha o resumo', async ({
    page,
    browser,
    baseURL,
    viewport,
    isMobile,
    hasTouch,
  }) => {
    // O segundo jogador usa a mesma tela do projeto: o aviso também precisa caber nela.
    const outroNavegador = await browser.newContext({ baseURL, viewport, isMobile, hasTouch });
    await dispensarResumoDasRegras(outroNavegador);
    const quemEspera = await outroNavegador.newPage();

    await sentarNaSala(page, 'Novato');
    const codigo = (await page.locator('.lobby__codigo-valor').textContent())?.trim() ?? '';
    await sentarNaSala(quemEspera, 'Paciente', codigo);
    await page.getByRole('button', { name: 'Iniciar partida' }).click();

    const resumo = page.getByRole('dialog', { name: 'Regras em 1 minuto' });
    await expect(resumo.getByRole('status')).toContainText('esperando você', {
      timeout: ESPERA_DA_MESA_MS,
    });

    const aviso = quemEspera.getByRole('alertdialog', { name: 'Partida pausada' });
    await expect(aviso).toContainText('Jogador noob lendo as regras!');
    await expect(aviso).toContainText('Novato abriu o resumo das regras');
    await expect(aviso.locator('.votacao__espera strong')).toHaveText(TEMPO_RESTANTE);
    expect(contem(telaDe(quemEspera), await medir(aviso))).toBe(true);

    await resumo.getByRole('button', { name: 'Entendi' }).click();
    await expect(aviso).toBeHidden();
    await outroNavegador.close();
  });
});

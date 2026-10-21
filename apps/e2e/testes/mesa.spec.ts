import { expect, test } from '@playwright/test';
import {
  abrirCenario,
  ALTURA_MINIMA_DO_BOTAO_PX,
  contem,
  distancia,
  ESPERA_DA_MESA_MS,
  esperarAnimacoes,
  esperarSemRolagem,
  jogarAteAMesaTer,
  medir,
  MESA_CHEIA,
  palpitarQualquerCoisa,
  RODADA_LONGA,
  telaDe,
} from './apoio';

/** Quantas cartas na mesa bastam para a fila da líder + pilha ficar apertada. */
const CARTAS_NA_MESA_PARA_MEDIR = 6;
/** Entre uma vaza e outra as cartas voam por ~1 s; isso dá folga para alguma pousar. */
const ESPERA_PARA_POUSAR_MS = 10_000;
/** Folga entre o botão de reações e os números do palpite: dois toques rápidos não erram o alvo. */
const FOLGA_DO_BOTAO_DE_REACOES_PX = 8;
/** Coração menor que isso some na tela do celular (já aconteceu). */
const LARGURA_MINIMA_DO_CORACAO_PX = 8;

test.describe('Mesa cheia (10 jogadores, 13 cartas)', () => {
  test('cabe na tela sem rolar, com a mão e as vidas à mostra', async ({ page }) => {
    await abrirCenario(page);
    await expect(page.locator('.mao__posicao')).toHaveCount(MESA_CHEIA.cartas, {
      timeout: ESPERA_DA_MESA_MS,
    });
    await esperarAnimacoes(page);
    await esperarSemRolagem(page);

    const tela = telaDe(page);
    expect(contem(tela, await medir(page.locator('.mao')))).toBe(true);
    expect(contem(tela, await medir(page.locator('.feltro')))).toBe(true);

    const coracao = await medir(page.locator('.minha__vidas .coracao').first());
    expect(coracao.width).toBeGreaterThanOrEqual(LARGURA_MINIMA_DO_CORACAO_PX);
  });

  test('o resumo das regras abre no começo, cabe na tela e não volta depois de dispensado', async ({
    page,
  }) => {
    await abrirCenario(page, { ...MESA_CHEIA, comResumoDasRegras: true });
    const resumo = page.getByRole('dialog', { name: 'Regras em 1 minuto' });
    await expect(resumo).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    // A mesa só fica pausada depois que o servidor aceita: o aviso de espera confirma.
    await expect(resumo.getByRole('status')).toContainText('esperando você');
    await expect(resumo).toContainText('1×');

    // Os dois botões ficam à vista sem rolar o diálogo, até no celular baixo.
    expect(
      await resumo.evaluate((caixa) => caixa.scrollHeight - caixa.clientHeight),
    ).toBeLessThanOrEqual(1);
    const tela = telaDe(page);
    const dispensar = resumo.getByRole('button', { name: 'Não perguntar novamente' });
    expect(contem(tela, await medir(dispensar))).toBe(true);
    expect(contem(tela, await medir(resumo.getByRole('button', { name: 'Entendi' })))).toBe(true);

    await dispensar.click();
    await expect(resumo).toBeHidden();
    await expect(page.locator('.sobreposicao')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.mesa')).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    await expect(resumo).toBeHidden();
  });

  test('recarregar a página durante a leitura não deixa o resumo cobrindo a mesa', async ({
    page,
  }) => {
    await abrirCenario(page, { ...MESA_CHEIA, comResumoDasRegras: true });
    const resumo = page.getByRole('dialog', { name: 'Regras em 1 minuto' });
    await expect(resumo.getByRole('status')).toContainText('esperando você', {
      timeout: ESPERA_DA_MESA_MS,
    });

    // A leitura é 1 por partida: de volta à mesa, o servidor recusa a segunda e a mesa não pausa.
    await page.reload();
    await expect(page.locator('.mesa')).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    await expect(resumo).toBeHidden();
  });

  test('o botão de reações fica longe dos números do palpite', async ({ page }) => {
    await abrirCenario(page);
    await expect(page.locator('.palpite')).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    await esperarAnimacoes(page);

    const botao = await medir(page.locator('.reacoes__botao'));
    const alvos = page.locator('.palpite__opcao, .palpite__rodape .botao, .palpite__mais');
    for (const alvo of await alvos.all()) {
      expect(distancia(botao, await medir(alvo))).toBeGreaterThanOrEqual(
        FOLGA_DO_BOTAO_DE_REACOES_PX,
      );
    }
  });

  test('o botão de reações não cobre o selo da manilha', async ({ page }) => {
    await abrirCenario(page);
    await expect(page.locator('.palpite')).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    await palpitarQualquerCoisa(page);
    await esperarAnimacoes(page);

    const botao = await medir(page.locator('.reacoes__botao'));
    const selo = await medir(page.locator('.feltro__manilha'));
    expect(distancia(botao, selo)).toBeGreaterThan(0);
  });

  test('o palpite cabe no feltro sem rolar e com botões tocáveis', async ({ page }) => {
    await abrirCenario(page);
    const painel = page.locator('.palpite');
    await expect(painel).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    await esperarAnimacoes(page);
    await esperarSemRolagem(page);

    const rolagemInterna = await painel.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(rolagemInterna, 'o painel de palpite não pode rolar por dentro').toBeLessThanOrEqual(1);

    const caixaDoPainel = await medir(painel);
    expect(contem(telaDe(page), caixaDoPainel)).toBe(true);

    const opcoes = page.locator('.palpite__opcao');
    await expect(opcoes).toHaveCount(MESA_CHEIA.cartas + 1);
    for (const opcao of await opcoes.all()) {
      const caixa = await medir(opcao);
      expect(caixa.height).toBeGreaterThanOrEqual(ALTURA_MINIMA_DO_BOTAO_PX);
      expect(contem(caixaDoPainel, caixa)).toBe(true);
    }
    await expect(page.locator('.palpite__rodape .botao')).toBeInViewport();
    // Com um número escolhido o botão ganha a segunda linha ("ou toque 2×"), que já vazou dele.
    await opcoes.nth(1).click();
    const confirmar = page.locator('.palpite__confirmar');
    await expect(confirmar).toContainText('2×');
    expect(await confirmar.evaluate((b) => b.scrollWidth - b.clientWidth)).toBeLessThanOrEqual(1);
    // As vidas continuam visíveis durante o palpite (já ficaram cobertas por ele).
    await expect(page.locator('.minha__vidas')).toBeInViewport();
  });

  test('o toque duplo na mesa não marca texto nem dá zoom', async ({ page }) => {
    await abrirCenario(page);
    await expect(page.locator('.palpite')).toBeVisible({ timeout: ESPERA_DA_MESA_MS });

    // Errar o alvo do gesto de confirmar (2 toques) marcava as palavras em volta.
    await page.locator('.palpite__titulo').dblclick();
    expect(await page.evaluate(() => getSelection()?.toString() ?? '')).toBe('');

    // O Chromium do teste não dá zoom no toque duplo; o iPhone dá, a menos que a mesa peça
    // "manipulation" (pinça e rolagem continuam).
    for (const alvo of ['.palpite__opcao', '.mao .carta', '.reacoes__botao', '.feltro']) {
      const gestos = await page
        .locator(alvo)
        .first()
        .evaluate((el) => getComputedStyle(el).touchAction);
      expect(gestos, alvo).toBe('manipulation');
    }
  });

  test('as cartas jogadas ficam dentro do feltro', async ({ page }) => {
    await abrirCenario(page);
    await jogarAteAMesaTer(page, CARTAS_NA_MESA_PARA_MEDIR);
    await esperarAnimacoes(page);
    await esperarSemRolagem(page);

    const feltro = await medir(page.locator('.feltro'));
    // Com bots instantâneos outras cartas continuam chegando (ou a vaza fecha e todas voam para o
    // montinho): mede só as que já pousaram, esperando haver alguma.
    const medirPousadas = () =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('[data-carta-mesa]'))
          .filter((carta) => carta.getAnimations({ subtree: true }).length === 0)
          .map((carta) => {
            const r = carta.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }),
      );
    let pousadas = await medirPousadas();
    await expect
      .poll(async () => (pousadas = await medirPousadas()).length, {
        timeout: ESPERA_PARA_POUSAR_MS,
      })
      .toBeGreaterThan(0);
    for (const caixa of pousadas) {
      expect(contem(feltro, caixa), 'carta da mesa vazando do feltro').toBe(true);
    }
  });

  test('a dica das reações fica em destaque só até a primeira reação do aparelho', async ({
    page,
  }) => {
    await abrirCenario(page);
    const botao = page.locator('.reacoes__botao');
    const destaque = page.locator('.reacoes__dica.dica-do-gesto');
    await botao.click();
    await expect(destaque).toBeVisible();
    expect(contem(telaDe(page), await medir(page.locator('.reacoes__painel')))).toBe(true);

    await page.locator('.reacoes__opcao').first().dblclick();
    await botao.click();
    await expect(page.locator('.reacoes__dica')).toBeVisible();
    await expect(destaque).toHaveCount(0);
  });

  test('placar e regras abrem a qualquer momento e cabem na tela', async ({ page }, info) => {
    await abrirCenario(page);
    const celular = info.project.use.isMobile === true;
    // No celular o topo fica recolhido atrás da alça.
    if (celular) await page.locator('.alca-topo').click();

    await page.getByRole('button', { name: 'Placar' }).first().click();
    const placar = page.getByRole('dialog', { name: 'Placar' });
    await expect(placar).toBeVisible();
    await expect(placar.locator('.placar__linha')).toHaveCount(MESA_CHEIA.jogadores);
    await page.keyboard.press('Escape');
    await expect(placar).toBeHidden();

    if (celular) await page.locator('.alca-topo').click();
    await page.getByRole('button', { name: 'Regras' }).first().click();
    const regras = page.getByRole('dialog', { name: /regras/i });
    await expect(regras).toBeVisible();
    await esperarAnimacoes(page);
    expect(contem(telaDe(page), await medir(regras))).toBe(true);
  });
});

test.describe('Rodada longa (2 jogadores, 19 cartas)', () => {
  test('só a grade do palpite rola: título e Confirmar à vista', async ({ page }) => {
    await abrirCenario(page, RODADA_LONGA);
    const painel = page.locator('.palpite');
    await expect(painel).toBeVisible({ timeout: ESPERA_DA_MESA_MS });
    await esperarAnimacoes(page);
    await esperarSemRolagem(page);

    const rolagemInterna = await painel.evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(rolagemInterna, 'quem rola é a grade, não o painel').toBeLessThanOrEqual(1);
    const caixaDoPainel = await medir(painel);
    expect(contem(telaDe(page), caixaDoPainel)).toBe(true);
    for (const parte of ['.palpite__titulo', '.palpite__rodape .botao']) {
      expect(contem(caixaDoPainel, await medir(page.locator(parte))), parte).toBe(true);
    }

    // O último número alcançável rolando a grade, e a escolha chega ao Confirmar.
    const ultima = page.locator('.palpite__opcao:not([disabled])').last();
    await ultima.scrollIntoViewIfNeeded();
    await ultima.click();
    await expect(page.locator('.palpite__confirmar')).toContainText(
      `Confirmar ${await ultima.textContent()}`,
    );
  });
});

import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
  await page.goto(info.project.metadata.backend === 'webgl2' ? '/?backend=webgl2' : '/');
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
});

test('selector previo al vuelo: nave predeterminada y helicóptero seleccionable, también tras reiniciar el navegador', async ({ page }) => {
  const choice = page.getByRole('combobox', { name: 'Vehículo', exact: true });
  await expect(choice).toHaveValue('ship');
  await choice.selectOption('helicopter');
  await expect(page.locator('.vehicle-help')).toContainText('2 pasajeros');
  await page.getByRole('combobox', { name: 'Modo de juego' }).selectOption('rescue');
  await page.getByRole('button', { name: /INICIAR VUELO/ }).click();
  expect(await page.evaluate(() => window.__VOID_RESCUE__!.getState().vehicleId)).toBe('helicopter');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getMetrics().renderedModel)).toBe('helicopter');

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Volver al menú' }).click();
  await expect(choice).toHaveValue('helicopter');
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  await expect(choice).toHaveValue('helicopter');
});

test('los récords antiguos permanecen como nave y el filtro permite elegir helicóptero', async ({ page }) => {
  await page.getByRole('button', { name: /VER RÉCORDS/ }).click();
  const records = page.getByRole('dialog', { name: /Récords de pilotos/ });
  await expect(records).toBeVisible();
  const vehicle = records.getByRole('combobox', { name: 'Récords: vehículo' });
  await expect(vehicle).toHaveValue('ship');
  await vehicle.selectOption('helicopter');
  await expect(vehicle).toHaveValue('helicopter');
  await records.getByRole('button', { name: /VOLVER/ }).click();
  await page.getByRole('combobox', { name: 'Vehículo', exact: true }).selectOption('helicopter');
  await page.getByRole('button', { name: /VER RÉCORDS/ }).click();
  await expect(vehicle).toHaveValue('helicopter');
});

test('el helicóptero rescata con cable de recogida y cabina de dos plazas', async ({ page }) => {
  await page.getByRole('combobox', { name: 'Vehículo', exact: true }).selectOption('helicopter');
  await page.getByRole('combobox', { name: 'Modo de juego' }).selectOption('rescue');
  await page.getByRole('button', { name: /INICIAR VUELO/ }).click();
  await page.evaluate(() => window.__VOID_RESCUE__!.loadScenario('rescue-pickup', 8042, 'helicopter'));
  await page.locator('#game').focus();
  await page.keyboard.down('KeyE');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getState().colonists[0]?.status), { timeout: 12000 }).toBe('carried');
  await page.keyboard.up('KeyE');
  const state = await page.evaluate(() => window.__VOID_RESCUE__!.getState());
  expect(state.colonists[0]!.onboard).toBe(true);
  await expect(page.locator('#combat-stats')).toContainText('A BORDO');
  await expect(page.locator('#combat-stats')).toContainText('1/2');
});

test('la nave elegida conserva la extracción clásica y la capacidad no limitada', async ({ page }) => {
  const choice = page.getByRole('combobox', { name: 'Vehículo', exact: true });
  await choice.selectOption('ship');
  await page.getByRole('combobox', { name: 'Modo de juego' }).selectOption('rescue');
  await page.getByRole('button', { name: /INICIAR VUELO/ }).click();
  await page.evaluate(() => window.__VOID_RESCUE__!.loadScenario('rescue-pickup', 8042, 'ship'));
  await page.locator('#game').focus();
  await page.keyboard.down('KeyE');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getState().colonists[0]?.status), { timeout: 12000 }).toBe('carried');
  await page.keyboard.up('KeyE');
  await expect(page.locator('#combat-stats')).toContainText('1/8');
});

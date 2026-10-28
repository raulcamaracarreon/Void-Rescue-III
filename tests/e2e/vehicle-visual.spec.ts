import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
  await page.goto(info.project.metadata.backend === 'webgl2' ? '/?backend=webgl2' : '/');
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
});

test('el modelo del helicóptero se integra solo en modo diagnóstico y se puede volver a la nave', async ({ page }) => {
  const initial = await page.evaluate(() => ({
    state: window.__VOID_RESCUE__!.getState(),
    metrics: window.__VOID_RESCUE__!.getMetrics(),
  }));
  expect(initial.state.vehicleId).toBe('ship');
  expect(initial.metrics.vehicleId).toBe('ship');
  expect(initial.metrics.renderedModel).toBe('ship');

  await page.evaluate(() => window.__VOID_RESCUE__!.loadScenario('flight-basic', 304, 'helicopter'));
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getState().vehicleId)).toBe('helicopter');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getMetrics().vehicleId)).toBe('helicopter');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getMetrics().renderedModel)).toBe('helicopter');
  const start = await page.evaluate(() => window.__VOID_RESCUE__!.getState().player.x);
  await page.locator('#game').focus();
  await page.keyboard.down('KeyD');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getState().player.x)).toBeGreaterThan(start + 2);
  await page.keyboard.up('KeyD');

  await page.evaluate(() => window.__VOID_RESCUE__!.loadScenario('flight-basic', 304, 'ship'));
  expect(await page.evaluate(() => window.__VOID_RESCUE__!.getState().vehicleId)).toBe('ship');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getMetrics().vehicleId)).toBe('ship');
  await expect.poll(async () => page.evaluate(() =>
    window.__VOID_RESCUE__!.getMetrics().renderedModel)).toBe('ship');
});

test('el perfil experimental no se activa al iniciar partida normal ni acepta vehículos desconocidos', async ({ page }) => {
  const invalid = await page.evaluate(() => {
    try {
      window.__VOID_RESCUE__!.loadScenario('flight-basic', 304, 'not-a-vehicle' as never);
      return '';
    } catch (error) {
      return (error as Error).message;
    }
  });
  expect(invalid).toContain('Vehículo no implementado');
  await page.getByRole('button', { name: /INICIAR VUELO/ }).click();
  expect(await page.evaluate(() => window.__VOID_RESCUE__!.getState().vehicleId)).toBe('ship');
  expect(await page.evaluate(() => window.__VOID_RESCUE__!.getMetrics().vehicleId)).toBe('ship');
  expect(await page.evaluate(() => window.__VOID_RESCUE__!.getMetrics().renderedModel)).toBe('ship');
});

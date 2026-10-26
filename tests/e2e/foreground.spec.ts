import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads',
    { configurable: true, value: () => [] }));
  await page.goto(info.project.metadata.backend === 'webgl2' ? '/?backend=webgl2' : '/');
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
});

test('configura primer plano visual sin alterar el orden de paisajes', async ({ page }) => {
  const original = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.cyclePool);
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await dialog.getByRole('checkbox', { name: 'Activar primer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de primer plano' }).selectOption('fence');
  await dialog.getByRole('spinbutton', { name: 'Opacidad de primer plano' }).fill('60');
  await dialog.getByRole('spinbutton', { name: 'Opacidad de primer plano' }).press('Tab');
  await dialog.getByRole('spinbutton', { name: 'Paralaje de primer plano' }).fill('120');
  await dialog.getByRole('spinbutton', { name: 'Paralaje de primer plano' }).press('Tab');
  const changed = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(changed.selection).toBe('custom');
  expect(changed.cyclePool).toEqual(original);
  expect(changed.custom.foreground).toMatchObject({
    enabled: true, kind: 'fence', opacity: 0.6, parallax: 1.2,
  });
  await dialog.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  const restored = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(restored.custom.foreground).toEqual(changed.custom.foreground);
  expect(restored.cyclePool).toEqual(original);
});

test('guarda el primer plano con un mundo propio, lo recupera y puede desactivarlo', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await dialog.getByRole('combobox', { name: 'Estilo de paisaje' }).selectOption('city');
  await dialog.getByRole('checkbox', { name: 'Activar primer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de primer plano' }).selectOption('trees');
  await dialog.getByRole('textbox', { name: 'Nombre del paisaje' }).fill('Selva experimental');
  await dialog.getByRole('button', { name: 'Guardar nuevo' }).click();
  const saved = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(saved.library).toHaveLength(1);
  expect(saved.library[0]!.style.foreground?.enabled).toBe(true);
  await dialog.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const reopened = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await expect(reopened.getByRole('checkbox', { name: 'Activar primer plano' })).toBeChecked();
  await reopened.getByRole('checkbox', { name: 'Activar primer plano' }).uncheck();
  await reopened.getByRole('button', { name: 'Guardar cambios' }).click();
  const updated = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(updated.library[0]!.style.foreground?.enabled).toBe(false);
});

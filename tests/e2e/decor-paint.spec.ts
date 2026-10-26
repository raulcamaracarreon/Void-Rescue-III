import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }, info) => {
  await page.setViewportSize({ width: 960, height: 540 });
  await page.addInitScript(() => Object.defineProperty(navigator, 'getGamepads',
    { configurable: true, value: () => [] }));
  await page.goto(info.project.metadata.backend === 'webgl2' ? '/?backend=webgl2' : '/');
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
});

test('permite opacidad al 100 % y edita dibujos diferentes en ambos planos', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('checkbox', { name: 'Activar primer plano' }).check();
  await landscape.getByRole('spinbutton', { name: 'Opacidad de primer plano' }).fill('100');
  await landscape.getByRole('spinbutton', { name: 'Opacidad de primer plano' }).press('Tab');
  await landscape.getByRole('checkbox', { name: 'Activar tercer plano' }).check();
  await landscape.getByRole('spinbutton', { name: 'Opacidad de tercer plano' }).fill('100');
  await landscape.getByRole('spinbutton', { name: 'Opacidad de tercer plano' }).press('Tab');
  await landscape.getByRole('button', { name: 'Dibujar primer plano' }).click();

  let editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  const canvas = editor.getByRole('img', { name: 'Lienzo de dibujo de silueta' })
    .or(editor.locator('canvas')).first();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * .12, bounds!.y + bounds!.height * .35);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * .28, bounds!.y + bounds!.height * .35, { steps: 8 });
  await page.mouse.up();
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();
  const afterFront = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(afterFront.foreground?.kind).toBe('drawing');
  expect(afterFront.foreground?.opacity).toBe(1);
  expect(afterFront.midground?.bitmap).toBeUndefined();
  expect(afterFront.foreground!.bitmap!.rows.join('')).toContain('1');

  await landscape.getByRole('button', { name: 'Dibujar tercer plano' }).click();
  editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  await editor.getByRole('combobox', { name: 'Herramienta de dibujo' }).selectOption('rectangle');
  const middleCanvas = editor.locator('canvas');
  const midBounds = await middleCanvas.boundingBox();
  expect(midBounds).not.toBeNull();
  await page.mouse.move(midBounds!.x + midBounds!.width * .62, midBounds!.y + midBounds!.height * .55);
  await page.mouse.down();
  await page.mouse.move(midBounds!.x + midBounds!.width * .80, midBounds!.y + midBounds!.height * .85, { steps: 5 });
  await page.mouse.up();
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();

  const afterMiddle = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(afterMiddle.midground?.kind).toBe('drawing');
  expect(afterMiddle.midground?.opacity).toBe(1);
  expect(afterMiddle.midground!.bitmap!.rows.join('')).toContain('1');
  expect(afterMiddle.foreground!.bitmap!.rows).not.toEqual(afterMiddle.midground!.bitmap!.rows);
  await landscape.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  const reloaded = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(reloaded.foreground?.bitmap).toEqual(afterMiddle.foreground?.bitmap);
  expect(reloaded.midground?.bitmap).toEqual(afterMiddle.midground?.bitmap);
});

test('cancelar no cambia el dibujo, y deshacer y rehacer conservan la máscara', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('button', { name: 'Dibujar primer plano' }).click();
  let editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  let bounds = await editor.locator('canvas').boundingBox();
  await page.mouse.click(bounds!.x + bounds!.width * .35, bounds!.y + bounds!.height * .5);
  await editor.getByRole('button', { name: 'Cancelar' }).click();
  expect((await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom))
    .foreground?.bitmap).toBeUndefined();
  await landscape.getByRole('button', { name: 'Dibujar primer plano' }).click();
  editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  bounds = await editor.locator('canvas').boundingBox();
  await page.mouse.click(bounds!.x + bounds!.width * .35, bounds!.y + bounds!.height * .5);
  await expect(editor.getByRole('button', { name: 'Deshacer' })).toBeEnabled();
  await editor.getByRole('button', { name: 'Deshacer' }).click();
  await expect(editor.getByRole('button', { name: 'Rehacer' })).toBeEnabled();
  await editor.getByRole('button', { name: 'Rehacer' }).click();
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();
  const saved = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(saved.foreground?.kind).toBe('drawing');
  expect(saved.foreground?.bitmap?.rows.join('')).toContain('1');
});

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
  const canvas = editor.locator('canvas');
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
  await expect(editor.locator('.decor-paint-status')).not.toContainText('· 0 pintados ·');
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


test('usa panorama 2048×256 por defecto, cambia resolución sin destruir dibujos antiguos', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('button', { name: 'Dibujar tercer plano' }).click();
  let editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  let resolution = editor.getByRole('combobox', { name: 'Resolución del lienzo' });
  await expect(resolution).toHaveValue('2048');
  await expect(editor.locator('.decor-paint-status')).toContainText('2048 × 256');
  const bounds = await editor.locator('canvas').boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.2, bounds!.y + bounds!.height * 0.25);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.65, bounds!.y + bounds!.height * 0.7, { steps: 10 });
  await page.mouse.up();
  await expect(editor.locator('.decor-paint-status')).toContainText('pintados');

  await resolution.selectOption('1024');
  await expect(editor.locator('.decor-paint-status')).toContainText('1024 × 128');
  await editor.getByRole('button', { name: 'Deshacer' }).click();
  await expect(resolution).toHaveValue('2048');
  await editor.getByRole('button', { name: 'Rehacer' }).click();
  await expect(resolution).toHaveValue('1024');
  await resolution.selectOption('512');
  await resolution.selectOption('384');
  await resolution.selectOption('192');
  await resolution.selectOption('96');
  await expect(editor.locator('.decor-paint-status')).toContainText('96 × 32');
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();

  const first = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom.midground!.bitmap!);
  expect(first.width).toBe(96);
  expect(first.height).toBe(32);
  expect(first.rows.join('')).toContain('1');
  await landscape.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const reopened = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await reopened.getByRole('button', { name: 'Dibujar tercer plano' }).click();
  editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  resolution = editor.getByRole('combobox', { name: 'Resolución del lienzo' });
  await expect(resolution).toHaveValue('96'); // legacy masks reopen without migration
  await resolution.selectOption('288');
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();
  const after = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom.midground!.bitmap!);
  expect(after.width).toBe(288);
  expect(after.height).toBe(96);
  expect(after.rows.join('')).toContain('1');
});


test('permite pintar el extremo derecho del panorama con zoom ajustado a pantalla', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('button', { name: 'Dibujar tercer plano' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  await expect(editor.getByRole('combobox', { name: 'Zoom del lienzo' })).toHaveValue('1');
  const canvas = editor.locator('canvas');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  // The 80%-of-width drawing previously landed outside a 2x zoomed viewport.
  const from = { x: bounds!.x + bounds!.width * 0.62, y: bounds!.y + bounds!.height * 0.25 };
  const to = { x: bounds!.x + bounds!.width * 0.83, y: bounds!.y + bounds!.height * 0.75 };
  await editor.getByRole('combobox', { name: 'Herramienta de dibujo' }).selectOption('rectangle');
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect(editor.locator('.decor-paint-status')).not.toContainText('· 0 pintados ·');
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();
  const saved = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom.midground!.bitmap!);
  expect(saved.rows.some(row => row.slice(Math.floor(saved.width * 0.6)).includes('1'))).toBe(true);
});

test('incorpora zoom, pincel grueso, elipse, triángulo y polígono relleno', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('button', { name: 'Dibujar primer plano' }).click();
  const dialog = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  const zoom = dialog.getByRole('combobox', { name: 'Zoom del lienzo' });
  const canvas = dialog.locator('canvas');
  await expect(dialog.getByRole('combobox', { name: 'Resolución del lienzo' })).toHaveValue('2048');
  await expect(zoom).toHaveValue('1');
  await dialog.getByRole('button', { name: 'Acercar lienzo' }).click();
  await expect(zoom).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Acercar lienzo' }).click();
  await expect(zoom).toHaveValue('4');
  await expect(canvas).toHaveCSS('width', /.+px/);
  await dialog.getByRole('button', { name: 'Alejar lienzo' }).click();
  await expect(zoom).toHaveValue('2');
  await zoom.selectOption('1');

  await dialog.getByRole('slider', { name: 'Grosor del pincel' }).evaluate(element => {
    const slider = element as HTMLInputElement;
    slider.value = '12';
    slider.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(dialog.locator('.decor-paint-brush-value')).toHaveText('12 px');
  const rectangle = await canvas.boundingBox();
  expect(rectangle).not.toBeNull();
  await page.mouse.click(rectangle!.x + rectangle!.width * .10, rectangle!.y + rectangle!.height * .25);
  await dialog.getByRole('combobox', { name: 'Herramienta de dibujo' }).selectOption('circle');
  await page.mouse.move(rectangle!.x + rectangle!.width * .20, rectangle!.y + rectangle!.height * .10);
  await page.mouse.down();
  await page.mouse.move(rectangle!.x + rectangle!.width * .27, rectangle!.y + rectangle!.height * .70, { steps: 5 });
  await page.mouse.up();
  await dialog.getByRole('combobox', { name: 'Herramienta de dibujo' }).selectOption('triangle');
  await page.mouse.move(rectangle!.x + rectangle!.width * .35, rectangle!.y + rectangle!.height * .20);
  await page.mouse.down();
  await page.mouse.move(rectangle!.x + rectangle!.width * .44, rectangle!.y + rectangle!.height * .70, { steps: 5 });
  await page.mouse.up();
  await dialog.getByRole('combobox', { name: 'Herramienta de dibujo' }).selectOption('polygon');
  await page.mouse.click(rectangle!.x + rectangle!.width * .55, rectangle!.y + rectangle!.height * .20);
  await page.mouse.click(rectangle!.x + rectangle!.width * .68, rectangle!.y + rectangle!.height * .27);
  await page.mouse.click(rectangle!.x + rectangle!.width * .62, rectangle!.y + rectangle!.height * .80);
  await expect(dialog.getByRole('button', { name: 'Cerrar polígono' })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Cerrar polígono' }).click();
  await dialog.getByRole('button', { name: 'Aplicar dibujo' }).click();
  const style = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(style.foreground?.kind).toBe('drawing');
  expect(style.foreground?.bitmap?.width).toBe(2048);
  expect(style.foreground?.bitmap?.height).toBe(256);
  expect(style.foreground?.bitmap?.rows.join('')).toContain('1');
});

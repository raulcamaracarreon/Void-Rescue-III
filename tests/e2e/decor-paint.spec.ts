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


test('círculo y triángulo rellenos forman figuras y no trazos libres', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });

  for (const item of [
    { plane: 'primer plano', field: 'foreground', tool: 'circle',
      left: 0.10, right: 0.25, top: 0.16, bottom: 0.82,
      insideX: 0.175, insideY: 0.30 },
    { plane: 'tercer plano', field: 'midground', tool: 'triangle',
      left: 0.42, right: 0.65, top: 0.20, bottom: 0.80,
      insideX: 0.535, insideY: 0.65 },
  ] as const) {
    await landscape.getByRole('button', { name: `Dibujar ${item.plane}` }).click();
    const editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
    await expect(editor.getByRole('combobox', { name: 'Zoom del lienzo' })).toHaveValue('1');
    await editor.getByRole('combobox', { name: 'Herramienta de dibujo' }).selectOption(item.tool);
    await editor.getByRole('checkbox', { name: 'Rellenar figura' }).check();
    const canvas = editor.locator('canvas');
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    await page.mouse.move(bounds!.x + bounds!.width * item.left,
      bounds!.y + bounds!.height * item.top);
    await page.mouse.down();
    await page.mouse.move(bounds!.x + bounds!.width * item.right,
      bounds!.y + bounds!.height * item.bottom, { steps: 9 });
    await page.mouse.up();
    await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();

    const bitmap = await page.evaluate(
      (field) => window.__VOID_RESCUE__!.getState().landscape.custom[field]!.bitmap!,
      item.field,
    );
    const filledY = Math.floor(bitmap.height * item.insideY);
    const filledX = Math.floor(bitmap.width * item.insideX);
    const cornerY = Math.floor(bitmap.height * item.top);
    const cornerX = Math.floor(bitmap.width * item.left);
    // Interior point intentionally lies away from the drag diagonal. A freehand
    // stroke may paint along that diagonal, but cannot fill this interior.
    expect(bitmap.rows[filledY]![filledX]).toBe('1');
    expect(bitmap.rows[cornerY]![cornerX]).toBe('0');
  }
});


test('selección rectangular panorámica es visible pero no altera los píxeles ni el historial', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('button', { name: 'Dibujar primer plano' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  const tool = editor.getByRole('combobox', { name: 'Herramienta de dibujo' });
  const canvas = editor.locator('canvas');
  const deselect = editor.getByRole('button', { name: 'Cancelar selección' });
  const undo = editor.getByRole('button', { name: 'Deshacer' });
  const status = editor.locator('.decor-paint-status');
  await expect(editor.getByRole('combobox', { name: 'Resolución del lienzo' })).toHaveValue('2048');
  await expect(deselect).toBeDisabled();

  await tool.selectOption('rectangle');
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  await page.mouse.move(bounds!.x + bounds!.width * 0.10, bounds!.y + bounds!.height * 0.20);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.34, bounds!.y + bounds!.height * 0.75, { steps: 7 });
  await page.mouse.up();
  const before = await status.innerText();
  const count = before.match(/(\d+) pintados/)?.[1];
  expect(count).toBeDefined();
  expect(Number(count)).toBeGreaterThan(0);
  await expect(undo).toBeEnabled();
  const baselineCanvas = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL());

  await tool.selectOption('select');
  await page.mouse.move(bounds!.x + bounds!.width * 0.82, bounds!.y + bounds!.height * 0.82);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width * 0.56, bounds!.y + bounds!.height * 0.27, { steps: 7 });
  await page.mouse.up();
  await expect(status).toContainText('selección x=');
  await expect(status).toContainText(`${count} pintados`);
  await expect(deselect).toBeEnabled();
  await expect(undo).toBeEnabled();
  const overlayCanvas = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL());
  expect(overlayCanvas).not.toBe(baselineCanvas);

  await deselect.click();
  await expect(deselect).toBeDisabled();
  await expect(status).not.toContainText('selección x=');
  const resetCanvas = await canvas.evaluate(node => (node as HTMLCanvasElement).toDataURL());
  expect(resetCanvas).toBe(baselineCanvas);
  await editor.getByRole('button', { name: 'Aplicar dibujo' }).click();
  const saved = await page.evaluate(() =>
    window.__VOID_RESCUE__!.getState().landscape.custom.foreground!.bitmap!);
  expect(saved.width).toBe(2048);
  expect(saved.rows.join('').match(/1/g)?.length).toBe(Number(count));
});

test('la selección conserva coordenadas con zoom y scroll y se cancela con Escape', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const landscape = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await landscape.getByRole('button', { name: 'Dibujar tercer plano' }).click();
  const editor = page.getByRole('dialog', { name: 'Editor de dibujo de plano' });
  const resolution = editor.getByRole('combobox', { name: 'Resolución del lienzo' });
  const zoom = editor.getByRole('combobox', { name: 'Zoom del lienzo' });
  const tool = editor.getByRole('combobox', { name: 'Herramienta de dibujo' });
  const status = editor.locator('.decor-paint-status');
  const viewport = editor.getByRole('region', { name: 'Área desplazable del dibujo' });
  await resolution.selectOption('96');
  await tool.selectOption('select');
  await zoom.selectOption('4');

  const scroll = await viewport.evaluate(node => {
    node.scrollLeft = Math.round(node.scrollWidth * 0.43);
    node.scrollTop = Math.round(node.scrollHeight * 0.28);
    return { left: node.scrollLeft, top: node.scrollTop };
  });
  expect(scroll.left).toBeGreaterThan(0);
  expect(scroll.top).toBeGreaterThan(0);
  const box = await viewport.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.25, box!.y + box!.height * 0.22);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.72, box!.y + box!.height * 0.64, { steps: 8 });
  await page.mouse.up();
  const selectedStatus = await status.innerText();
  const coords = selectedStatus.match(/selección x=(\d+), y=(\d+) · (\d+) × (\d+) px/);
  expect(coords).not.toBeNull();
  expect(Number(coords![1])).toBeGreaterThan(0);
  expect(Number(coords![2])).toBeGreaterThan(0);
  expect(Number(coords![1]) + Number(coords![3])).toBeLessThanOrEqual(96);
  expect(Number(coords![2]) + Number(coords![4])).toBeLessThanOrEqual(32);
  await zoom.selectOption('1');
  await expect(status).toContainText(coords![0]); // zoom must not rewrite pixel coordinates
  await page.keyboard.press('Escape');
  await expect(editor).toBeVisible(); // first Escape deselects; does not close the editor
  await expect(status).not.toContainText('selección x=');
  await expect(editor.getByRole('button', { name: 'Deshacer' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(editor).not.toBeVisible();
});

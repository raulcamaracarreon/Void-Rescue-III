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


test('permite editar dos planos decorativos independientes y conservarlos tras recargar', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await expect(dialog.getByRole('checkbox', { name: 'Activar tercer plano' })).not.toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: 'Activar primer plano' })).not.toBeChecked();

  await dialog.getByRole('checkbox', { name: 'Activar tercer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de tercer plano' }).selectOption('grille');
  await dialog.getByRole('spinbutton', { name: 'Paralaje de tercer plano' }).fill('70');
  await dialog.getByRole('spinbutton', { name: 'Paralaje de tercer plano' }).press('Tab');
  await dialog.getByRole('spinbutton', { name: 'Opacidad de tercer plano' }).fill('42');
  await dialog.getByRole('spinbutton', { name: 'Opacidad de tercer plano' }).press('Tab');

  await dialog.getByRole('checkbox', { name: 'Activar primer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de primer plano' }).selectOption('trees');
  await dialog.getByRole('spinbutton', { name: 'Paralaje de primer plano' }).fill('125');
  await dialog.getByRole('spinbutton', { name: 'Paralaje de primer plano' }).press('Tab');

  const saved = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(saved.custom.midground).toMatchObject({
    enabled: true, kind: 'grille', parallax: 0.7, opacity: 0.42,
  });
  expect(saved.custom.foreground).toMatchObject({
    enabled: true, kind: 'trees', parallax: 1.25,
  });
  await dialog.getByRole('checkbox', { name: 'Activar tercer plano' }).uncheck();
  const independentlyDisabled = await page.evaluate(
    () => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(independentlyDisabled.foreground?.enabled).toBe(true);
  expect(independentlyDisabled.midground?.enabled).toBe(false);

  await dialog.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const reopened = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await expect(reopened.getByRole('checkbox', { name: 'Activar primer plano' })).toBeChecked();
  await expect(reopened.getByRole('checkbox', { name: 'Activar tercer plano' })).not.toBeChecked();
  await reopened.getByRole('checkbox', { name: 'Activar tercer plano' }).check();
  expect((await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape)).custom
    .midground?.kind).toBe('grille');
});

test('guarda y recupera ambas capas decorativas en un paisaje con nombre', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await dialog.getByRole('combobox', { name: 'Estilo de paisaje' }).selectOption('ice');
  await dialog.getByRole('checkbox', { name: 'Activar tercer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de tercer plano' }).selectOption('fence');
  await dialog.getByRole('checkbox', { name: 'Activar primer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de primer plano' }).selectOption('grille');
  await dialog.getByRole('textbox', { name: 'Nombre del paisaje' }).fill('Doble profundidad');
  await dialog.getByRole('button', { name: 'Guardar nuevo' }).click();
  const changed = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(changed.library).toHaveLength(1);
  expect(changed.library[0]!.style.midground?.kind).toBe('fence');
  expect(changed.library[0]!.style.foreground?.kind).toBe('grille');
  await dialog.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  const restored = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(restored.library[0]!.style.midground?.enabled).toBe(true);
  expect(restored.library[0]!.style.foreground?.enabled).toBe(true);
  expect(restored.library[0]!.name).toBe('Doble profundidad');
});


test('ofrece gradiente normal e inverso independiente en cada plano y conserva el color manual', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await dialog.getByRole('combobox', { name: 'Estilo de paisaje' }).selectOption('ice');
  await dialog.getByRole('checkbox', { name: 'Activar tercer plano' }).check();
  await dialog.getByRole('checkbox', { name: 'Activar primer plano' }).check();

  const midMode = dialog.getByRole('combobox', { name: 'Modo de color de tercer plano' });
  const frontMode = dialog.getByRole('combobox', { name: 'Modo de color de primer plano' });
  const midInvert = dialog.getByRole('checkbox', { name: 'Invertir gradiente de tercer plano' });
  const frontInvert = dialog.getByRole('checkbox', { name: 'Invertir gradiente de primer plano' });
  const midSwatch = dialog.locator('input[type="color"][data-midground="color"]');
  const frontSwatch = dialog.locator('input[type="color"][data-foreground="color"]');
  await expect(midInvert).toBeDisabled();
  await expect(frontInvert).toBeDisabled();

  await midMode.selectOption('gradient');
  await frontMode.selectOption('gradient');
  await expect(midInvert).toBeEnabled();
  await expect(frontInvert).toBeEnabled();
  await expect(midSwatch).toBeDisabled();
  await expect(frontSwatch).toBeDisabled();
  const normalMid = await midSwatch.inputValue();
  const normalFront = await frontSwatch.inputValue();
  const palette = await dialog.locator('.landscape-swatches span')
    .evaluateAll(elements => elements.map(element => ({
      label: element.getAttribute('aria-label'),
      color: (element as HTMLElement).style.backgroundColor,
    })));
  const nearestBackdrop = palette.at(-3)!.color;
  const penultimateBackdrop = palette.at(-4)!.color;
  const middlePreview = palette.at(-2)!;
  const frontPreview = palette.at(-1)!;
  expect(middlePreview.label).toBe('Tercer plano');
  expect(frontPreview.label).toBe('Primer plano');
  expect(new Set([penultimateBackdrop, nearestBackdrop, middlePreview.color, frontPreview.color]).size)
    .toBe(4);
  const toCssRgb = (hex: string): string =>
    'rgb(' + [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(', ') + ')';
  expect(middlePreview.color).toBe(toCssRgb(normalMid));
  expect(frontPreview.color).toBe(toCssRgb(normalFront));
  await midInvert.check();
  const inverseMid = await midSwatch.inputValue();
  expect(inverseMid).not.toEqual(normalMid);
  expect(toCssRgb(inverseMid)).not.toBe(penultimateBackdrop);
  expect(Number.parseInt(inverseMid.slice(1, 3), 16))
    .toBeGreaterThan(Number.parseInt(normalMid.slice(1, 3), 16));
  await expect(frontSwatch).toHaveValue(normalFront);
  await frontInvert.check();
  expect(await frontSwatch.inputValue()).not.toEqual(normalFront);

  const state = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(state.custom.midground).toMatchObject({ colorMode: 'gradient', invertGradient: true });
  expect(state.custom.foreground).toMatchObject({ colorMode: 'gradient', invertGradient: true });
  await dialog.getByRole('textbox', { name: 'Nombre del paisaje' }).fill('Contraste inverso');
  await dialog.getByRole('button', { name: 'Guardar nuevo' }).click();
  await dialog.getByRole('button', { name: /LISTO/ }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  const reloaded = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape);
  expect(reloaded.library[0]!.style.midground).toMatchObject({ colorMode: 'gradient', invertGradient: true });
  expect(reloaded.library[0]!.style.foreground).toMatchObject({ colorMode: 'gradient', invertGradient: true });

  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const reopened = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await reopened.getByRole('combobox', { name: 'Modo de color de primer plano' }).selectOption('manual');
  await expect(reopened.locator('input[type="color"][data-foreground="color"]')).toBeEnabled();
  await expect(reopened.locator('input[type="color"][data-foreground="color"]'))
    .toHaveValue(reloaded.library[0]!.style.foreground!.color);
  await expect(reopened.getByRole('checkbox', { name: 'Invertir gradiente de primer plano' }))
    .toBeDisabled();
});


test('edita edificios y longitud lateral independiente, con persistencia sin perder gradientes', async ({ page }) => {
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await dialog.getByRole('combobox', { name: 'Estilo de paisaje' }).selectOption('ice');

  await dialog.getByRole('checkbox', { name: 'Activar tercer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de tercer plano' }).selectOption('buildings');
  await dialog.getByRole('spinbutton', { name: 'Longitud lateral de tercer plano' }).fill('25');
  await dialog.getByRole('spinbutton', { name: 'Longitud lateral de tercer plano' }).press('Tab');
  await dialog.getByRole('combobox', { name: 'Modo de color de tercer plano' }).selectOption('gradient');
  await dialog.getByRole('checkbox', { name: 'Invertir gradiente de tercer plano' }).check();

  await dialog.getByRole('checkbox', { name: 'Activar primer plano' }).check();
  await dialog.getByRole('combobox', { name: 'Motivo de primer plano' }).selectOption('buildings');
  await dialog.getByRole('spinbutton', { name: 'Longitud lateral de primer plano' }).fill('65');
  await dialog.getByRole('spinbutton', { name: 'Longitud lateral de primer plano' }).press('Tab');
  const style = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.custom);
  expect(style.midground).toMatchObject({
    enabled: true, kind: 'buildings', spanPercent: 25,
    colorMode: 'gradient', invertGradient: true,
  });
  expect(style.foreground).toMatchObject({
    enabled: true, kind: 'buildings', spanPercent: 65,
    colorMode: 'manual', invertGradient: false,
  });

  await dialog.getByRole('textbox', { name: 'Nombre del paisaje' }).fill('Ciudad con tramos libres');
  await dialog.getByRole('button', { name: 'Guardar nuevo' }).click();
  const saved = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.library);
  expect(saved).toHaveLength(1);
  expect(saved[0]!.style.foreground?.spanPercent).toBe(65);
  expect(saved[0]!.style.midground?.spanPercent).toBe(25);
  await dialog.getByRole('button', { name: /LISTO/ }).click();

  await page.reload();
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  const restored = await page.evaluate(() => window.__VOID_RESCUE__!.getState().landscape.library[0]!.style);
  expect(restored.foreground).toEqual(saved[0]!.style.foreground);
  expect(restored.midground).toEqual(saved[0]!.style.midground);
  await page.getByRole('button', { name: /PERSONALIZAR PAISAJE/ }).click();
  const reopened = page.getByRole('dialog', { name: 'Personalizar paisaje' });
  await expect(reopened.getByRole('combobox', { name: 'Motivo de primer plano' })).toHaveValue('buildings');
  await expect(reopened.getByRole('combobox', { name: 'Motivo de tercer plano' })).toHaveValue('buildings');
  await expect(reopened.getByRole('spinbutton', { name: 'Longitud lateral de tercer plano' })).toHaveValue('25');
  await expect(reopened.getByRole('spinbutton', { name: 'Longitud lateral de primer plano' })).toHaveValue('65');
});

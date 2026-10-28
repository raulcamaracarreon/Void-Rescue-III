import { expect, test } from '@playwright/test';

/** The game uses a 16:9 viewport. At browser zoom 100%, the entire preflight
 * menu must fit without clipping/overlap in standard desktop window sizes.
 * A too-small viewport may scroll the title itself, not force browser zoom.
 */
for (const [width, height] of [[1280, 720], [1084, 609], [960, 540]] as const) {
  test(`portada en dos columnas visible a zoom 100% (${width}×${height})`, async ({ page }, info) => {
    await page.setViewportSize({ width, height });
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'getGamepads', { configurable: true, value: () => [] }));
    await page.goto(info.project.metadata.backend === 'webgl2' ? '/?backend=webgl2' : '/');
    await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));

    const layout = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector<HTMLElement>(selector);
        if (!element) throw new Error(`Elemento de portada ausente: ${selector}`);
        const { x, y, width, height, left, right, top, bottom } = element.getBoundingClientRect();
        return { x, y, width, height, left, right, top, bottom };
      };
      const panel = document.querySelector<HTMLElement>('.title-config')!;
      const controlSelectors = [
        '.spawn-mode-select', '.mission-mode-select', '.difficulty-select',
        '.rescue-protocol-select', '.vehicle-select',
        '.title-config .engine-pitch-slider',
        '.title-config .pilot-initial',
        '.title-config [data-action="records"]',
        '.title-config [data-action="start"]',
        '.title-config [data-action="landscape"]',
        '.title-config [data-action="controller"]',
      ];
      return {
        title: rect('.title-screen'), hero: rect('.title-hero'),
        config: rect('.title-config'), footer: rect('.title-footer'),
        panelHeight: panel.clientHeight, contentHeight: panel.scrollHeight,
        controls: controlSelectors.map(rect),
      };
    });

    // Both columns are separate, not a long list underneath the title.
    expect(layout.config.left).toBeGreaterThan(layout.hero.right + 4);
    expect(layout.config.right).toBeLessThan(layout.title.right - 4);
    expect(layout.config.bottom).toBeLessThan(layout.footer.top - 4);
    expect(layout.hero.bottom).toBeLessThan(layout.footer.top - 4);
    expect(layout.contentHeight).toBeLessThanOrEqual(layout.panelHeight + 2);
    for (const rect of layout.controls) {
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.height).toBeGreaterThan(0);
      expect(rect.left).toBeGreaterThanOrEqual(layout.config.left);
      expect(rect.right).toBeLessThanOrEqual(layout.config.right);
      expect(rect.top).toBeGreaterThanOrEqual(layout.config.top);
      expect(rect.bottom).toBeLessThanOrEqual(layout.config.bottom + 1);
    }
  });
}

test('en pantalla estrecha la portada permite desplazar su contenido sin reducir el zoom', async ({ page }, info) => {
  await page.setViewportSize({ width: 600, height: 420 });
  await page.goto(info.project.metadata.backend === 'webgl2' ? '/?backend=webgl2' : '/');
  await page.waitForFunction(() => Boolean(window.__VOID_RESCUE__));
  const layout = await page.evaluate(() => {
    const title = document.querySelector<HTMLElement>('.title-screen')!;
    const hero = document.querySelector<HTMLElement>('.title-hero')!;
    const config = document.querySelector<HTMLElement>('.title-config')!;
    return {
      scrollable: title.scrollHeight > title.clientHeight,
      flow: getComputedStyle(config).position === 'static',
      columns: getComputedStyle(document.querySelector<HTMLElement>('.title-copy')!).gridTemplateColumns,
      heroBottom: hero.getBoundingClientRect().bottom,
      configTop: config.getBoundingClientRect().top,
    };
  });
  expect(layout.scrollable).toBe(true);
  expect(layout.heroBottom).toBeLessThan(layout.configTop);
  await expect(page.getByRole('combobox', { name: 'Vehículo', exact: true })).toBeAttached();
});

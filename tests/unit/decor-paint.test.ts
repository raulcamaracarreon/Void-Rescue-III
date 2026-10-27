import { describe, expect, it } from 'vitest';
import { Group, Mesh } from 'three/webgpu';
import {
  blankDecorBitmap, copyLandscape, DECOR_BITMAP_HEIGHT, DECOR_BITMAP_WIDTH,
  DECOR_BITMAP_WIDTHS,
  DEFAULT_FOREGROUND, DEFAULT_MIDGROUND, defaultLandscapePreferences,
  sanitizeDecorBitmap, sanitizeLandscapePreferences,
} from '../../src/landscape/LandscapeConfig';
import { decorInkCount, drawDecorPixels, drawDecorPolygon, resizeDecorBitmap } from '../../src/landscape/DecorDrawing';
import { FOREGROUND_DEPTH, MIDGROUND_DEPTH, ForegroundDecor, drawingMotifWidth,
  decorSpanWidth } from '../../src/render/ForegroundDecor';

describe('fase 3 — siluetas de mapa de bits', () => {
  it('representa máscaras pequeñas y validadas, sin almacenar código ni HTML', () => {
    const empty = blankDecorBitmap();
    expect(empty.rows).toHaveLength(DECOR_BITMAP_HEIGHT);
    expect(empty.rows.every(row => row.length === DECOR_BITMAP_WIDTH)).toBe(true);
    expect(decorInkCount(empty)).toBe(0);
    const bad = { version: 1, width: 96, height: 32,
      rows: Array.from({ length: 32 }, () => '<script>'.repeat(12)) };
    expect(decorInkCount(sanitizeDecorBitmap(bad))).toBe(0);
    expect(sanitizeDecorBitmap({ ...empty, width: 1000 })).toEqual(empty);
    expect(sanitizeDecorBitmap({ ...empty, rows: ['1'] })).toEqual(empty);
    expect(empty.width).toBe(2048);
    expect(empty.height).toBe(256);
    for (const width of DECOR_BITMAP_WIDTHS) {
      const mask = blankDecorBitmap(width);
      expect(sanitizeDecorBitmap(mask)).toEqual(mask);
      expect(mask.height).toBe(width <= 384 ? width / 3 : width / 8);
    }
    const old = blankDecorBitmap(96);
    old.rows[3] = '1' + '0'.repeat(95);
    expect(sanitizeDecorBitmap(JSON.parse(JSON.stringify(old)))).toEqual(old);
  });

  it('dibuja con pincel, línea, rectángulo y borrador, sin cambiar el origen', () => {
    const original = blankDecorBitmap();
    const dot = drawDecorPixels(original, 'brush', { x: 4, y: 6 }, { x: 4, y: 6 });
    expect(original.rows[6]![4]).toBe('0');
    expect(dot.rows[6]![4]).toBe('1');
    const diagonal = drawDecorPixels(dot, 'line', { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(diagonal.rows[2]![2]).toBe('1');
    const square = drawDecorPixels(diagonal, 'rectangle', { x: 20, y: 10 }, { x: 25, y: 15 });
    expect(square.rows[10]![22]).toBe('1');
    expect(square.rows[12]![20]).toBe('1');
    expect(square.rows[12]![22]).toBe('0');
    const erased = drawDecorPixels(square, 'eraser', { x: 0, y: 0 }, { x: 5, y: 5 });
    expect(erased.rows[2]![2]).toBe('0');
    expect(erased.rows[10]![22]).toBe('1');
  });

  it('migra configuraciones antiguas y protege dibujos duplicados entre planos', () => {
    const prefs = defaultLandscapePreferences();
    prefs.selection = 'custom';
    const drawing = drawDecorPixels(blankDecorBitmap(), 'rectangle',
      { x: 4, y: 5 }, { x: 20, y: 18 });
    prefs.custom.foreground = { ...DEFAULT_FOREGROUND, enabled: true,
      kind: 'drawing', bitmap: drawing, opacity: 1 };
    prefs.custom.midground = { ...DEFAULT_MIDGROUND, enabled: true,
      kind: 'drawing', bitmap: drawDecorPixels(blankDecorBitmap(), 'brush',
        { x: 75, y: 16 }, { x: 75, y: 16 }), opacity: 1 };
    const saved = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(prefs)));
    expect(saved.custom.foreground).toEqual(prefs.custom.foreground);
    expect(saved.custom.midground).toEqual(prefs.custom.midground);
    expect(saved.custom.foreground!.opacity).toBe(1);
    expect(saved.custom.midground!.opacity).toBe(1);
    const copy = copyLandscape(saved.custom);
    copy.foreground!.bitmap!.rows[0] = '1'.repeat(DECOR_BITMAP_WIDTH);
    expect(saved.custom.foreground!.bitmap!.rows[0]).toBe(drawing.rows[0]);
    expect(saved.custom.midground!.bitmap!.rows[0]).not.toBe(copy.foreground!.bitmap!.rows[0]);

    const legacy = sanitizeLandscapePreferences({ selection: 'custom', custom: {
      ...prefs.custom, foreground: { enabled: true, kind: 'trees',
        color: '#456789', opacity: 0.85, parallax: 1.1 },
    } });
    expect(legacy.custom.foreground?.opacity).toBe(0.85);
    expect(legacy.custom.foreground?.bitmap).toBeUndefined();
  });

  it('cambia entre las cuatro resoluciones sin deformar ni destruir el mapa original', () => {
    const legacy = blankDecorBitmap(96);
    const painted = drawDecorPixels(legacy, 'rectangle', { x: 5, y: 6 }, { x: 30, y: 20 });
    for (const width of DECOR_BITMAP_WIDTHS) {
      const resized = resizeDecorBitmap(painted, width);
      expect(resized.width).toBe(width);
      expect(resized.height).toBe(width <= 384 ? width / 3 : width / 8);
      expect(decorInkCount(resized)).toBeGreaterThan(0);
      expect(sanitizeDecorBitmap(resized)).toEqual(resized);
    }
    const high = resizeDecorBitmap(painted, 384);
    expect(high.rows[24]![20]).toBe('1');
    expect(painted.width).toBe(96);
    expect(painted.height).toBe(32);
    expect(resizeDecorBitmap(painted, 123)).toEqual(painted);
    expect(drawingMotifWidth(painted)).toBe(150);
    expect(drawingMotifWidth(high)).toBe(150);
  });


  it('guarda máscaras grandes en formato binario compacto y recupera filas idénticas', () => {
    const canvas = drawDecorPixels(blankDecorBitmap(2048), 'rectangle',
      { x: 130, y: 35 }, { x: 500, y: 160 }, { filled: true });
    const json = JSON.stringify(sanitizeDecorBitmap(canvas));
    const serialized = JSON.parse(json);
    expect(serialized.version).toBe(2);
    expect(serialized.width).toBe(2048);
    expect(json.length).toBeLessThan(100000); // 2048x256 = 524,288 raw characters
    const recovered = sanitizeDecorBitmap(serialized);
    expect(recovered.rows).toEqual(canvas.rows);
    expect(decorInkCount(recovered)).toBeGreaterThan(10000);
    expect(sanitizeDecorBitmap({ ...serialized, packed: 'malformed' }).rows.join(''))
      .not.toContain('1');
    const legacy = drawDecorPixels(blankDecorBitmap(96), 'brush',
      { x: 5, y: 8 }, { x: 20, y: 8 });
    expect(sanitizeDecorBitmap(legacy).rows).toEqual(legacy.rows);
  });

  it('convierte arte antiguo a panorama sin deformar figuras ni perder líneas finas', () => {
    const old = drawDecorPixels(blankDecorBitmap(96), 'rectangle',
      { x: 10, y: 5 }, { x: 35, y: 25 }, { filled: true });
    const panoramic = resizeDecorBitmap(old, 2048);
    expect(panoramic.width).toBe(2048);
    expect(panoramic.height).toBe(256);
    // The old 3:1 motif occupies only 768 of 2048 columns; the rest is empty.
    expect(panoramic.rows.every(row => row.slice(768).indexOf('1') < 0)).toBe(true);
    expect(panoramic.rows[100]![160]).toBe('1');
    expect(panoramic.rows[100]![900]).toBe('0');
    const returned = resizeDecorBitmap(panoramic, 96);
    expect(returned.width).toBe(96);
    expect(returned.height).toBe(32);
    expect(decorInkCount(returned)).toBeGreaterThan(0);
    const thin = drawDecorPixels(blankDecorBitmap(2048), 'line',
      { x: 50, y: 20 }, { x: 1900, y: 230 });
    expect(decorInkCount(resizeDecorBitmap(thin, 96))).toBeGreaterThan(0);
  });

  it('pinta círculos, triángulos, polígonos rellenos y grosores configurables', () => {
    const blank = blankDecorBitmap(512);
    const thin = drawDecorPixels(blank, 'brush', { x: 24, y: 23 },
      { x: 24, y: 23 }, { size: 1 });
    const thick = drawDecorPixels(blank, 'brush', { x: 24, y: 23 },
      { x: 24, y: 23 }, { size: 9 });
    expect(decorInkCount(thin)).toBe(1);
    expect(decorInkCount(thick)).toBe(81);
    const erased = drawDecorPixels(thick, 'eraser', { x: 24, y: 23 },
      { x: 24, y: 23 }, { size: 9 });
    expect(decorInkCount(erased)).toBe(0);
    const circle = drawDecorPixels(blank, 'circle', { x: 5, y: 5 },
      { x: 60, y: 50 }, { filled: true });
    expect(circle.rows[28]![32]).toBe('1');
    expect(circle.rows[0]![0]).toBe('0');
    const triangle = drawDecorPixels(blank, 'triangle', { x: 70, y: 5 },
      { x: 130, y: 55 }, { filled: true });
    expect(triangle.rows[45]![100]).toBe('1');
    const polygon = drawDecorPolygon(blank, [
      { x: 150, y: 5 }, { x: 230, y: 5 }, { x: 245, y: 52 }, { x: 150, y: 52 },
    ], { filled: true });
    expect(polygon.rows[20]![200]).toBe('1');
    expect(polygon.rows[60]![200]).toBe('0');
    expect(drawDecorPolygon(blank, [{ x: 1, y: 1 }], { filled: true })).toEqual(blank);
  });

  it('usa panoramas 8:1 con más de una pantalla de ancho, sin estirar las siluetas', () => {
    const wide = blankDecorBitmap(2048);
    const render = new ForegroundDecor();
    const bitmap = drawDecorPixels(wide, 'line', { x: 10, y: 20 },
      { x: 600, y: 100 }, { size: 5 });
    expect(drawingMotifWidth(bitmap)).toBe(400);
    render.rebuild({ ...DEFAULT_FOREGROUND, kind: 'drawing', enabled: true,
      bitmap, spanPercent: 100 }, 8042, 9, 1);
    const copy = render.group.children[1] as Group;
    expect(copy.children).toHaveLength(6); // 2400 / 400 = 6
    expect(copy.children.map(child => child.position.x)).toEqual([0, 400, 800, 1200, 1600, 2000]);
    render.dispose();
  });

  it('proyecta el dibujo en ambos planos y deja fuera los píxeles transparentes', () => {
    const bitmap = drawDecorPixels(blankDecorBitmap(288), 'rectangle',
      { x: 10, y: 10 }, { x: 20, y: 20 });
    for (const [depth, defaults] of [
      [FOREGROUND_DEPTH, DEFAULT_FOREGROUND], [MIDGROUND_DEPTH, DEFAULT_MIDGROUND],
    ] as const) {
      const render = new ForegroundDecor(depth);
      render.rebuild({ ...defaults, kind: 'drawing', enabled: true,
        bitmap, opacity: 1, spanPercent: 25 }, 8042, 7, 1);
      expect(render.group.children).toHaveLength(3);
      // 25% of a 2400-unit world = 600, precisely four 150-unit motifs.
      const copy = render.group.children[1] as Group;
      expect(copy.children).toHaveLength(4);
      expect(copy.children.map(child => child.position.x)).toEqual([0, 150, 300, 450]);
      const tiled = copy.children as Mesh[];
      expect(tiled[0]!.geometry).toBe(tiled[1]!.geometry); // shared asset
      const attr = tiled[0]!.geometry.getAttribute('position');
      expect(attr.count).toBeGreaterThan(0);
      expect(attr.getZ(0)).toBe(depth);
      expect(Math.max(...Array.from({ length: attr.count }, (_, i) => attr.getX(i))))
        .toBeLessThanOrEqual(drawingMotifWidth(bitmap));
      expect(decorSpanWidth(25)).toBe(600);
      render.dispose();
    }
  });
  it('recorta solo la última repetición sin comprimir el ancho del motivo', () => {
    const bitmap = drawDecorPixels(blankDecorBitmap(288), 'line',
      { x: 0, y: 6 }, { x: 287, y: 6 });
    const render = new ForegroundDecor();
    render.rebuild({ ...DEFAULT_FOREGROUND, kind: 'drawing', enabled: true,
      bitmap, spanPercent: 23 }, 8042, 8, 2);
    const group = render.group.children[1] as Group;
    const parts = group.children as Mesh[];
    expect(parts).toHaveLength(4);
    expect(parts.map(child => child.position.x)).toEqual([0, 150, 300, 450]);
    const full = parts[0]!.geometry.getAttribute('position');
    const partial = parts[3]!.geometry.getAttribute('position');
    expect(Math.max(...Array.from({ length: full.count }, (_, i) => full.getX(i))))
      .toBeCloseTo(150, 6);
    expect(Math.max(...Array.from({ length: partial.count }, (_, i) => partial.getX(i))))
      .toBeCloseTo(102, 6);
    expect(parts[0]!.geometry).toBe(parts[2]!.geometry);
    expect(parts[3]!.geometry).not.toBe(parts[0]!.geometry);
    render.update(1400);
    expect(Number.isFinite(group.position.x)).toBe(true);
    render.dispose();
  });
});

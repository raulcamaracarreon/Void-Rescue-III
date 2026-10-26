import { describe, expect, it } from 'vitest';
import { Mesh } from 'three/webgpu';
import {
  blankDecorBitmap, copyLandscape, DECOR_BITMAP_HEIGHT, DECOR_BITMAP_WIDTH,
  DEFAULT_FOREGROUND, DEFAULT_MIDGROUND, defaultLandscapePreferences,
  sanitizeDecorBitmap, sanitizeLandscapePreferences,
} from '../../src/landscape/LandscapeConfig';
import { decorInkCount, drawDecorPixels } from '../../src/landscape/DecorDrawing';
import { FOREGROUND_DEPTH, MIDGROUND_DEPTH, ForegroundDecor } from '../../src/render/ForegroundDecor';

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

  it('proyecta el dibujo en ambos planos y deja fuera los píxeles transparentes', () => {
    const bitmap = drawDecorPixels(blankDecorBitmap(), 'rectangle',
      { x: 10, y: 10 }, { x: 20, y: 20 });
    for (const [depth, defaults] of [
      [FOREGROUND_DEPTH, DEFAULT_FOREGROUND], [MIDGROUND_DEPTH, DEFAULT_MIDGROUND],
    ] as const) {
      const render = new ForegroundDecor(depth);
      render.rebuild({ ...defaults, kind: 'drawing', enabled: true,
        bitmap, opacity: 1, spanPercent: 25 }, 8042, 7, 1);
      expect(render.group.children).toHaveLength(3);
      const geometry = (render.group.children[1] as Mesh).geometry;
      const attr = geometry.getAttribute('position');
      expect(attr.count).toBeGreaterThan(0);
      expect(attr.getZ(0)).toBe(depth);
      expect(Math.max(...Array.from({ length: attr.count }, (_, i) => attr.getX(i))))
        .toBeLessThan(601);
      render.dispose();
    }
  });
});

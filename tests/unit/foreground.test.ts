import { describe, expect, it } from 'vitest';
import { Mesh } from 'three/webgpu';
import {
  copyLandscape, decorColorForStyle, DEFAULT_FOREGROUND, DEFAULT_MIDGROUND, defaultLandscapePreferences,
  mixLandscapeColors, resolveLandscape, sanitizeForeground, sanitizeMidground, sanitizeLandscapePreferences,
} from '../../src/landscape/LandscapeConfig';
import { ForegroundDecor, FOREGROUND_DEPTH, MIDGROUND_DEPTH, decorSpanWidth } from '../../src/render/ForegroundDecor';
import { CONFIG } from '../../src/game/config';

describe('primer plano decorativo opcional', () => {
  it('parte desactivado y no altera la selección ni el orden de los ambientes', () => {
    const preferences = defaultLandscapePreferences();
    expect(preferences.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    const pool = [...preferences.cyclePool];
    preferences.selection = 'custom';
    preferences.custom.foreground = {
      ...DEFAULT_FOREGROUND, enabled: true, kind: 'fence', color: '#335544', opacity: 0.55, parallax: 1.2,
    };
    const restored = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(preferences)));
    expect(restored.cyclePool).toEqual(pool);
    expect(restored.custom.foreground).toEqual(preferences.custom.foreground);
    expect(resolveLandscape(restored, 1).style.foreground).toEqual(preferences.custom.foreground);
  });

  it('sanea datos inválidos y conserva compatibilidad con paisajes anteriores', () => {
    expect(sanitizeForeground({ enabled: 'yes', kind: '<img>', color: 'xxx',
      opacity: Infinity, parallax: -4 })).toEqual({ ...DEFAULT_FOREGROUND, parallax: 1 });
    expect(sanitizeForeground({ enabled: true, kind: 'grille', color: '#abcdef',
      opacity: 12, parallax: 2 })).toEqual({
      ...DEFAULT_FOREGROUND, enabled: true, kind: 'grille', color: '#abcdef', opacity: 1, parallax: 1.35,
    });
    const older = defaultLandscapePreferences();
    delete older.custom.foreground;
    const restored = sanitizeLandscapePreferences(older);
    expect(restored.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    expect(restored.custom.foreground?.enabled).toBe(false);
  });


  it('deriva colores del mismo gradiente automático normal o invertido por plano', () => {
    const preferences = defaultLandscapePreferences();
    preferences.selection = 'custom';
    preferences.custom.automatic = {
      skyColor: '#000000', frontColor: '#ffffff', layerCount: 6, composition: 'mixed',
    };
    preferences.custom.foreground = {
      ...DEFAULT_FOREGROUND, enabled: true, color: '#abcdef', colorMode: 'gradient',
    };
    preferences.custom.midground = {
      ...DEFAULT_MIDGROUND, enabled: true, color: '#123456', colorMode: 'gradient',
    };
    const normal = resolveLandscape(preferences, 1).style;
    expect(decorColorForStyle(normal, 'foreground'))
      .toBe(mixLandscapeColors('#000000', '#ffffff', 0.95));
    expect(decorColorForStyle(normal, 'midground'))
      .toBe(mixLandscapeColors('#000000', '#ffffff', 0.75));
    preferences.custom.foreground.invertGradient = true;
    const invertedFront = resolveLandscape(preferences, 1).style;
    expect(decorColorForStyle(invertedFront, 'foreground'))
      .toBe(mixLandscapeColors('#000000', '#ffffff', 0.05));
    expect(decorColorForStyle(invertedFront, 'midground'))
      .toBe(decorColorForStyle(normal, 'midground'));
    preferences.custom.midground.invertGradient = true;
    const invertedBoth = resolveLandscape(preferences, 1).style;
    expect(decorColorForStyle(invertedBoth, 'midground'))
      .toBe(mixLandscapeColors('#000000', '#ffffff', 0.25));
    expect(invertedBoth.layers.at(-1)!.color).toBe('#ffffff');
    expect(preferences.custom.foreground.color).toBe('#abcdef');
    expect(preferences.custom.midground.color).toBe('#123456');
  });

  it('preserva colores manuales y migra paisajes anteriores al modo manual', () => {
    const prefs = defaultLandscapePreferences();
    prefs.selection = 'custom';
    prefs.custom.foreground = {
      ...DEFAULT_FOREGROUND, enabled: true, color: '#517294',
      colorMode: 'gradient', invertGradient: true,
    };
    prefs.custom.midground = {
      ...DEFAULT_MIDGROUND, enabled: true, color: '#cdef01',
      colorMode: 'gradient', invertGradient: false,
    };
    const restored = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(prefs)));
    expect(restored.custom.foreground).toEqual(prefs.custom.foreground);
    expect(restored.custom.midground).toEqual(prefs.custom.midground);
    const updatedStyle = copyLandscape(restored.custom);
    updatedStyle.foreground!.colorMode = 'manual';
    updatedStyle.midground!.colorMode = 'manual';
    expect(decorColorForStyle(updatedStyle, 'foreground')).toBe('#517294');
    expect(decorColorForStyle(updatedStyle, 'midground')).toBe('#cdef01');

    const oldFront = sanitizeForeground({ enabled: true, color: '#445566',
      kind: 'grille', opacity: 0.65, parallax: 1.2 });
    expect(oldFront.colorMode).toBe('manual');
    expect(oldFront.invertGradient).toBe(false);
    expect(oldFront.color).toBe('#445566');
    expect(sanitizeMidground({ colorMode: 'malicious', invertGradient: 'no' })).toMatchObject({
      colorMode: 'manual', invertGradient: false,
    });
  });

  it('independiza la configuración del primer plano al duplicar estilos', () => {
    const initial = defaultLandscapePreferences().custom;
    const copied = copyLandscape(initial);
    copied.foreground!.enabled = true;
    expect(initial.foreground!.enabled).toBe(false);
  });

  it('no crea geometría si está desactivado y libera mallas al desactivarlo', () => {
    const layer = new ForegroundDecor();
    layer.rebuild({ ...DEFAULT_FOREGROUND }, 8042, 1, 1);
    expect(layer.group.children).toHaveLength(0);
    layer.rebuild({ ...DEFAULT_FOREGROUND, enabled: true }, 8042, 1, 1);
    expect(layer.group.children).toHaveLength(3);
    layer.rebuild({ ...DEFAULT_FOREGROUND }, 8042, 1, 1);
    expect(layer.group.children).toHaveLength(0);
    layer.dispose();
  });


  it('crea dos configuraciones independientes y migra paisajes antiguos con primer plano', () => {
    const preferences = defaultLandscapePreferences();
    preferences.selection = 'custom';
    expect(preferences.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    expect(preferences.custom.midground).toEqual(DEFAULT_MIDGROUND);
    const oldLandscape = copyLandscape(preferences.custom);
    oldLandscape.foreground = { ...DEFAULT_FOREGROUND, enabled: true, kind: 'fence', opacity: 0.7 };
    delete oldLandscape.midground;
    preferences.library.push({ id: 'old-world', name: 'Antiguo', mode: 'automatic', style: oldLandscape });
    const restored = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(preferences)));
    expect(restored.library[0]!.style.foreground).toEqual(oldLandscape.foreground);
    expect(restored.library[0]!.style.midground).toEqual(DEFAULT_MIDGROUND);
    restored.library[0]!.style.midground!.enabled = true;
    expect(restored.library[0]!.style.foreground?.enabled).toBe(true);
    expect(oldLandscape.midground).toBeUndefined();
  });

  it('sanea el paralaje de cada plano dentro de su propio rango', () => {
    expect(sanitizeMidground({ enabled: true, kind: 'trees', color: '#998877',
      opacity: 0.45, parallax: 0.6 }).parallax).toBe(0.6);
    expect(sanitizeMidground({ parallax: -10 }).parallax).toBe(0.4);
    expect(sanitizeMidground({ parallax: 1.8 }).parallax).toBe(1);
    expect(sanitizeForeground({ parallax: 0.5 }).parallax).toBe(1);
    expect(sanitizeForeground({ parallax: 2 }).parallax).toBe(1.35);
  });

  it('duplica independientemente tanto tercer plano como primer plano', () => {
    const initial = defaultLandscapePreferences().custom;
    const duplicated = copyLandscape(initial);
    duplicated.foreground!.enabled = true;
    duplicated.midground!.enabled = true;
    duplicated.midground!.kind = 'grille';
    expect(initial.foreground!.enabled).toBe(false);
    expect(initial.midground!.enabled).toBe(false);
    expect(initial.midground!.kind).toBe('trees');
  });

  it('ubica el tercer plano detrás de los vehículos pero delante de los paisajes', () => {
    expect(MIDGROUND_DEPTH).toBeLessThan(0);
    expect(MIDGROUND_DEPTH).toBeGreaterThan(-31); // Nearest mountain/building silhouette
    expect(FOREGROUND_DEPTH).toBeGreaterThan(0);
    const mid = new ForegroundDecor(MIDGROUND_DEPTH, 0x7258c39d);
    const front = new ForegroundDecor(FOREGROUND_DEPTH);
    mid.rebuild({ ...DEFAULT_MIDGROUND, enabled: true }, 8042, 3, 2);
    front.rebuild({ ...DEFAULT_FOREGROUND, enabled: true }, 8042, 3, 2);
    const midMesh = mid.group.children[1] as Mesh;
    const frontMesh = front.group.children[1] as Mesh;
    const midPositions = midMesh.geometry.getAttribute('position');
    const frontPositions = frontMesh.geometry.getAttribute('position');
    expect(midPositions.getZ(0)).toBe(MIDGROUND_DEPTH);
    expect(frontPositions.getZ(0)).toBe(FOREGROUND_DEPTH);
    expect(midMesh.renderOrder).toBeLessThan(frontMesh.renderOrder);
    expect([...midPositions.array]).not.toEqual([...frontPositions.array]);
    mid.update(200);
    front.update(200);
    expect(midMesh.position.x).not.toBe(frontMesh.position.x);
    mid.dispose();
    front.dispose();
  });


  it('conserva compatibilidad con franjas antiguas y valida edificios y longitud', () => {
    const old = {
      ...DEFAULT_FOREGROUND, enabled: true, color: '#334455',
      kind: 'fence' as const, spanPercent: undefined,
    };
    const restored = sanitizeForeground(JSON.parse(JSON.stringify(old)));
    expect(restored.kind).toBe('fence');
    expect(restored.color).toBe('#334455');
    expect(restored.spanPercent).toBe(100);
    expect(sanitizeForeground({ kind: 'buildings', spanPercent: 25 }))
      .toMatchObject({ kind: 'buildings', spanPercent: 25 });
    expect(sanitizeMidground({ kind: 'buildings', spanPercent: 65 }))
      .toMatchObject({ kind: 'buildings', spanPercent: 65 });
    expect(sanitizeMidground({ spanPercent: -1 }).spanPercent).toBe(5);
    expect(sanitizeForeground({ spanPercent: 400 }).spanPercent).toBe(100);
    expect(sanitizeForeground({ opacity: 1 }).opacity).toBe(1);
    expect(sanitizeMidground({ opacity: 1 }).opacity).toBe(1);
    expect(sanitizeForeground({ spanPercent: Infinity }).spanPercent).toBe(100);
    expect(sanitizeForeground({ spanPercent: 24.6 }).spanPercent).toBe(25);
  });

  it('genera geometría truncada y repetible sin estirar motivos al acortar la franja', () => {
    expect(decorSpanWidth(100)).toBe(CONFIG.worldWidth);
    expect(decorSpanWidth(25)).toBe(CONFIG.worldWidth * 0.25);
    for (const kind of ['trees', 'fence', 'grille', 'buildings'] as const) {
      const full = new ForegroundDecor();
      const short = new ForegroundDecor();
      const repeated = new ForegroundDecor();
      const settings = { ...DEFAULT_FOREGROUND, enabled: true, kind };
      full.rebuild({ ...settings, spanPercent: 100 }, 8042, 77, 3);
      short.rebuild({ ...settings, spanPercent: 25 }, 8042, 77, 3);
      repeated.rebuild({ ...settings, spanPercent: 25 }, 8042, 77, 3);
      const fullPos = (full.group.children[1] as Mesh).geometry.getAttribute('position');
      const shortPos = (short.group.children[1] as Mesh).geometry.getAttribute('position');
      const repeatedPos = (repeated.group.children[1] as Mesh).geometry.getAttribute('position');
      expect(shortPos.count).toBeLessThan(fullPos.count);
      expect(shortPos.array).toEqual(repeatedPos.array);
      expect(Math.max(...Array.from({ length: shortPos.count }, (_, i) => shortPos.getX(i))))
        .toBeLessThanOrEqual(decorSpanWidth(25) + 0.001);
      // Buildings use rectilinear footprints and varied heights, not a scaled bitmap.
      expect(Math.max(...Array.from({ length: shortPos.count }, (_, i) => shortPos.getY(i))))
        .toBeGreaterThan(15);
      full.dispose(); short.dispose(); repeated.dispose();
    }
  });

  it('guarda anchos distintos por plano sin mezclarlos con el gradiente', () => {
    const prefs = defaultLandscapePreferences();
    prefs.selection = 'custom';
    prefs.custom.foreground = {
      ...DEFAULT_FOREGROUND, enabled: true, kind: 'buildings', spanPercent: 30,
      colorMode: 'gradient', invertGradient: true,
    };
    prefs.custom.midground = {
      ...DEFAULT_MIDGROUND, enabled: true, kind: 'trees', spanPercent: 70,
      colorMode: 'manual',
    };
    const cleaned = sanitizeLandscapePreferences(JSON.parse(JSON.stringify(prefs)));
    expect(cleaned.custom.foreground).toEqual(prefs.custom.foreground);
    expect(cleaned.custom.midground).toEqual(prefs.custom.midground);
    cleaned.custom.foreground!.spanPercent = 15;
    expect(cleaned.custom.midground!.spanPercent).toBe(70);
    expect(prefs.custom.foreground.spanPercent).toBe(30);
  });

  it('genera motivos repetibles sin dependencias del sistema de colisiones', () => {
    for (const kind of ['trees', 'fence', 'grille', 'buildings'] as const) {
      const a = new ForegroundDecor(), b = new ForegroundDecor();
      const config = { ...DEFAULT_FOREGROUND, enabled: true, kind };
      a.rebuild(config, 8042, 6, 3);
      b.rebuild(config, 8042, 6, 3);
      const meshA = a.group.children[0] as Mesh;
      const meshB = b.group.children[0] as Mesh;
      expect(meshA.geometry.getAttribute('position').array)
        .toEqual(meshB.geometry.getAttribute('position').array);
      expect(meshA.geometry.getAttribute('position').count).toBeGreaterThan(0);
      a.update(CONFIG.worldWidth - 1);
      const before = (a.group.children[1] as Mesh).position.x;
      a.update(CONFIG.worldWidth + 1);
      const after = (a.group.children[1] as Mesh).position.x;
      expect(Number.isFinite(before + after)).toBe(true);
      a.update(300, true);
      expect((a.group.children[1] as Mesh).position.x).toBe(0);
      a.dispose(); b.dispose();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { Mesh } from 'three/webgpu';
import {
  copyLandscape, DEFAULT_FOREGROUND, defaultLandscapePreferences, resolveLandscape,
  sanitizeForeground, sanitizeLandscapePreferences,
} from '../../src/landscape/LandscapeConfig';
import { ForegroundDecor } from '../../src/render/ForegroundDecor';
import { CONFIG } from '../../src/game/config';

describe('primer plano decorativo opcional', () => {
  it('parte desactivado y no altera la selección ni el orden de los ambientes', () => {
    const preferences = defaultLandscapePreferences();
    expect(preferences.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    const pool = [...preferences.cyclePool];
    preferences.selection = 'custom';
    preferences.custom.foreground = {
      enabled: true, kind: 'fence', color: '#335544', opacity: 0.55, parallax: 1.2,
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
      enabled: true, kind: 'grille', color: '#abcdef', opacity: 0.85, parallax: 1.35,
    });
    const older = defaultLandscapePreferences();
    delete older.custom.foreground;
    const restored = sanitizeLandscapePreferences(older);
    expect(restored.custom.foreground).toEqual(DEFAULT_FOREGROUND);
    expect(restored.custom.foreground?.enabled).toBe(false);
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

  it('genera motivos repetibles sin dependencias del sistema de colisiones', () => {
    for (const kind of ['trees', 'fence', 'grille'] as const) {
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
